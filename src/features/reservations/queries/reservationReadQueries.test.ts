import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import type {
  GuestReservationDetail,
  ReservationListPage,
} from "../model/reservationRead";
import type { ReservationReadApiPort } from "../ports/reservationReadApiPort";
import { reservationReadQueryKeys } from "./reservationReadQueryKeys";
import {
  createReservationDetailQueryOptions,
  createReservationListQueryOptions,
  useReservationListReadQuery,
} from "./reservationReadQueries";

const scope = {
  epoch: 4,
  subject:
    "subject:member_7" as AuthenticatedSessionScope["subject"],
};

const nextEpochScope = { ...scope, epoch: 5 };

const guestPage = (
  reservationUid: string,
  nextCursor: string | null = null,
): ReservationListPage<"guest"> => ({
  audience: "guest",
  reservations: [
    {
      audience: "guest",
      reservationId: Number(reservationUid.replace(/\D/g, "")) || 1,
      reservationUid,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-12",
      createdAt: "2026-07-01T00:00:00Z",
      accommodation: {
        id: 7,
        name: "테스트 숙소",
        thumbnailUrl: null,
      },
    },
  ],
  pageInfo: {
    currentSize: 1,
    hasNext: nextCursor !== null,
    nextCursor,
  },
});

const guestDetail = (reservationUid: string): GuestReservationDetail => ({
  audience: "guest",
  reservationUid,
  reservationCode: "R-1",
  status: "CONFIRMED",
  createdAt: "2026-07-01T00:00:00Z",
  guestCount: 2,
  checkInDateTime: "2026-07-10T15:00:00Z",
  checkOutDateTime: "2026-07-12T11:00:00Z",
  checkInTime: "15:00:00",
  checkOutTime: "11:00:00",
  canWriteReview: false,
  accommodation: { id: 7, name: "테스트 숙소", thumbnailUrl: null },
  address: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: null,
    street: "와우산로",
    detail: null,
    postalCode: "04000",
  },
  coordinate: { latitude: 37.5, longitude: 127 },
  host: { id: 9, nickname: "호스트", thumbnailImageUrl: null },
  payment: null,
});

const createApi = () => {
  const getList = vi.fn();
  const getDetail = vi.fn();
  return {
    api: {
      getList: getList as ReservationReadApiPort["getList"],
      getDetail: getDetail as ReservationReadApiPort["getDetail"],
    },
    getDetail,
    getList,
  };
};

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createWrapper = (queryClient: QueryClient) =>
  function QueryWrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

describe("reservation read query boundary", () => {
  it("uses explicit audience/session/filter keys even when one wrapped API owns both reads", async () => {
    const { api, getList } = createApi();
    getList.mockResolvedValue(guestPage("guest-1"));
    const signal = new AbortController().signal;
    const wrappedApi: ReservationReadApiPort = {
      getList: (...args) => api.getList(...args),
      getDetail: (...args) => api.getDetail(...args),
    };
    const guestOptions = createReservationListQueryOptions(
      {
        audience: "guest",
        filterType: "UPCOMING",
        scope,
      },
      wrappedApi,
    );
    const hostOptions = createReservationListQueryOptions(
      {
        audience: "host",
        filterType: "UPCOMING",
        scope,
      },
      wrappedApi,
    );

    await guestOptions.queryFn({ pageParam: undefined, signal });

    expect(guestOptions.queryKey).toEqual([
      "reservations",
      "read",
      "list",
      "guest",
      { filterType: "UPCOMING", size: 20 },
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(hostOptions.queryKey).toEqual([
      "reservations",
      "read",
      "list",
      "host",
      { filterType: "UPCOMING", size: 20 },
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(guestOptions.queryKey).not.toEqual(hostOptions.queryKey);
    expect(
      reservationReadQueryKeys.list(nextEpochScope, "guest", {
        filterType: "UPCOMING",
        size: 20,
      }),
    ).not.toEqual(guestOptions.queryKey);
    expect(guestOptions.meta).toEqual({ session: scope });
    expect(getList).toHaveBeenCalledWith(
      "guest",
      { filterType: "UPCOMING", size: 20 },
      { signal },
    );
    expect(guestOptions.retry).toBe(false);
    expect(guestOptions.throwOnError).toBe(false);
  });

  it("forwards the page cursor and derives only a server-confirmed next cursor", async () => {
    const { api, getList } = createApi();
    const options = createReservationListQueryOptions(
      {
        audience: "guest",
        filterType: "PAST",
        pageSize: 30,
        scope,
      },
      api,
    );
    const signal = new AbortController().signal;
    const page = guestPage("guest-1", "cursor-2");
    getList.mockResolvedValue(page);

    await options.queryFn({ pageParam: "cursor-1", signal });

    expect(getList).toHaveBeenCalledWith(
      "guest",
      { cursor: "cursor-1", filterType: "PAST", size: 30 },
      { signal },
    );
    expect(options.getNextPageParam(page)).toBe("cursor-2");
    expect(
      options.getNextPageParam({
        ...page,
        pageInfo: { currentSize: 1, hasNext: false, nextCursor: "ignored" },
      }),
    ).toBeUndefined();
  });

  it("keeps missing authenticated scope network-inert", () => {
    const { api, getList } = createApi();
    const options = createReservationListQueryOptions(
      {
        audience: "guest",
        filterType: "UPCOMING",
        scope: null,
      },
      api,
    );

    expect(options.enabled).toBe(false);
    expect(options.queryKey.at(-1)).toEqual({ session: null });
    expect(options).not.toHaveProperty("meta");
    expect(() =>
      options.queryFn({
        pageParam: undefined,
        signal: new AbortController().signal,
      }),
    ).toThrow("authenticated session");
    expect(getList).not.toHaveBeenCalled();
  });

  it("disables a missing detail UID and selects only the matching audience/resource", async () => {
    const { api, getDetail } = createApi();
    const signal = new AbortController().signal;
    const options = createReservationDetailQueryOptions(
      { audience: "guest", reservationUid: "reservation-1", scope },
      api,
    );
    getDetail.mockResolvedValue(guestDetail("reservation-1"));

    await options.queryFn({ signal });

    expect(options.queryKey).toEqual([
      "reservations",
      "read",
      "detail",
      "guest",
      "reservation-1",
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(getDetail).toHaveBeenCalledWith("guest", "reservation-1", {
      signal,
    });
    expect(options.select(guestDetail("reservation-1"))).toEqual(
      guestDetail("reservation-1"),
    );
    expect(options.select(guestDetail("reservation-99"))).toBeNull();
    expect(
      options.select({
        ...guestDetail("reservation-1"),
        audience: "host",
      } as never),
    ).toBeNull();

    const missing = createReservationDetailQueryOptions(
      { audience: "guest", reservationUid: null, scope },
      api,
    );
    expect(missing.enabled).toBe(false);
    expect(() => missing.queryFn({ signal })).toThrow("reservationUid");
  });

  it("does not surface an old filter page after the active list changes", async () => {
    const { api, getList } = createApi();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const oldNextPage = deferred<ReservationListPage<"guest">>();
    getList.mockImplementation(
      (
        _audience: "guest",
        request: { cursor?: string; filterType?: string },
      ) => {
        if (request.filterType === "UPCOMING" && !request.cursor) {
          return Promise.resolve(guestPage("upcoming-1", "next-upcoming"));
        }
        if (request.filterType === "UPCOMING") return oldNextPage.promise;
        return Promise.resolve(guestPage("past-1"));
      },
    );
    const wrapper = createWrapper(queryClient);
    type FilterProps = { filterType: "UPCOMING" | "PAST" };
    const { result, rerender } = renderHook(
      ({ filterType }: FilterProps) =>
        useReservationListReadQuery(
          { audience: "guest", filterType, scope },
          api,
        ),
      {
        initialProps: {
          filterType: "UPCOMING" as FilterProps["filterType"],
        },
        wrapper,
      },
    );

    await waitFor(() =>
      expect(
        result.current.data?.pages.at(0)?.reservations.at(0)?.reservationUid,
      ).toBe(
        "upcoming-1",
      ),
    );
    let oldNextRequest!: ReturnType<typeof result.current.fetchNextPage>;
    act(() => {
      oldNextRequest = result.current.fetchNextPage();
    });
    await waitFor(() => expect(getList).toHaveBeenCalledTimes(2));

    rerender({ filterType: "PAST" });
    await waitFor(() =>
      expect(
        result.current.data?.pages.at(0)?.reservations.at(0)?.reservationUid,
      ).toBe(
        "past-1",
      ),
    );

    await act(async () => {
      oldNextPage.resolve(guestPage("upcoming-2"));
      await oldNextRequest;
    });

    expect(result.current.data?.pages).toHaveLength(1);
    expect(
      result.current.data?.pages.at(0)?.reservations.at(0)?.reservationUid,
    ).toBe(
      "past-1",
    );
    queryClient.clear();
  });
});
