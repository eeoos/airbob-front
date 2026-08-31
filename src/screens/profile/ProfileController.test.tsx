import type { Mocked } from "vitest";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { HostListingsApiPort } from "../../features/profile/ports/hostListingsApiPort";
import type {
  HostListing,
  HostListingPage,
} from "../../features/profile/model/hostListing";
import type {
  GuestReservationListItem,
  HostReservationListItem,
  ReservationListPage,
} from "../../features/reservations/model/reservationRead";
import type { ReservationReadApiPort } from "../../features/reservations/ports/reservationReadApiPort";
import { AppError } from "../../platform/http/errors";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import type {
  HostListingManagementCommand,
  HostListingManagementResult,
  HostListingManagementWorkflow,
} from "../../workflows/host-listing-management";
import {
  ProfileController,
  type ProfileControllerProps,
  type ProfileHrefPort,
  type ProfileNavigationCommands,
  type ProfileRouteView,
} from "./ProfileController";

const scope: AuthenticatedSessionScope = {
  epoch: 4,
  subject: "subject:profile-controller" as SessionSubject,
};

const resolveImageUrl = (path: string | null) =>
  path === null ? "" : `https://assets.test${path}`;
const profileHrefs: ProfileHrefPort = {
  guestReservation: (reservationUid) =>
    `/reservations/${encodeURIComponent(reservationUid)}`,
};

const guestReservation = (
  reservationUid: string,
  accommodationName: string,
  checkInDate = "2027-08-03",
): GuestReservationListItem => ({
  accommodation: {
    id: 11,
    name: accommodationName,
    thumbnailUrl: "/guest-stay.jpg",
  },
  audience: "guest",
  checkInDate,
  checkOutDate: "2027-08-05",
  createdAt: "2027-07-01T00:00:00Z",
  reservationId: 101,
  reservationUid,
});

const hostReservation = ({
  checkInDate,
  reservationCode,
  reservationUid,
}: {
  checkInDate: string;
  reservationCode: string;
  reservationUid: string;
}): HostReservationListItem => ({
  accommodation: {
    id: 21,
    name: "호스트 숙소",
    thumbnailUrl: null,
  },
  audience: "host",
  checkInDate,
  checkOutDate: "2027-09-15",
  createdAt: "2027-07-01T00:00:00Z",
  currency: "KRW",
  guest: {
    id: 31,
    nickname: "게스트",
    thumbnailImageUrl: null,
  },
  guestCount: 2,
  reservationCode,
  reservationUid,
  status: "CONFIRMED",
  totalPrice: 210000,
});

const guestPage = (
  reservations: readonly GuestReservationListItem[],
): ReservationListPage<"guest"> => ({
  audience: "guest",
  pageInfo: {
    currentSize: reservations.length,
    hasNext: false,
    nextCursor: null,
  },
  reservations,
});

const hostPage = (
  reservations: readonly HostReservationListItem[],
): ReservationListPage<"host"> => ({
  audience: "host",
  pageInfo: {
    currentSize: reservations.length,
    hasNext: false,
    nextCursor: null,
  },
  reservations,
});

const listing = (overrides: Partial<HostListing> = {}): HostListing => ({
  addressSummary: {
    city: "서울",
    country: "대한민국",
    district: "중구",
    state: null,
  },
  createdAt: "2027-01-01T00:00:00Z",
  id: 41,
  name: "남산 숙소",
  status: "PUBLISHED",
  thumbnailUrl: "/host-stay.jpg",
  type: "HOUSE",
  ...overrides,
});

const listingPage = (
  listings: readonly HostListing[] = [listing()],
): HostListingPage => ({
  listings,
  pageInfo: {
    currentSize: listings.length,
    hasNext: false,
    nextCursor: null,
  },
});

const createReservationApi = () => {
  const getDetail = vi.fn();
  const getList = vi.fn();

  return {
    api: { getDetail, getList } as unknown as ReservationReadApiPort,
    getList,
  };
};

const createHostListingsApi = () => {
  const getHostListings = vi.fn().mockResolvedValue(listingPage());

  return {
    api: { getHostListings } as HostListingsApiPort,
    getHostListings,
  };
};

const createWorkflow = () => {
  const dispose = vi.fn();
  const execute = vi.fn();

  return {
    dispose,
    execute,
    workflow: {
      dispose,
      execute,
    } as unknown as Mocked<HostListingManagementWorkflow>,
  };
};

const createNavigation = (): Mocked<ProfileNavigationCommands> => ({
  changeGuestTab: vi.fn(),
  changeHostListingStatus: vi.fn(),
  changeHostReservationFilter: vi.fn(),
  changeHostSection: vi.fn(),
  changeMode: vi.fn(),
  editAccommodation: vi.fn(),
  openAccommodation: vi.fn(),
  openGuestReservation: vi.fn(),
  openHostReservation: vi.fn(),
});

interface RenderControllerOptions {
  readonly confirmDelete?: ProfileControllerProps["confirmDelete"];
  readonly hrefs?: ProfileHrefPort;
  readonly hostListingsApi?: HostListingsApiPort;
  readonly hostListingWorkflow?: HostListingManagementWorkflow;
  readonly navigation?: ProfileNavigationCommands;
  readonly reservationApi?: ReservationReadApiPort;
  readonly routeView: ProfileRouteView;
}

const renderController = ({
  confirmDelete = vi.fn(() => true),
  hrefs = profileHrefs,
  hostListingsApi,
  hostListingWorkflow = createWorkflow().workflow,
  navigation = createNavigation(),
  reservationApi,
  routeView,
}: RenderControllerOptions) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const controller = (nextRouteView: ProfileRouteView): ReactElement => (
    <QueryClientProvider client={queryClient}>
      <ProfileController
        confirmDelete={confirmDelete}
        hrefs={hrefs}
        hostListingWorkflow={hostListingWorkflow}
        navigation={navigation}
        resolveImageUrl={resolveImageUrl}
        routeView={nextRouteView}
        scope={scope}
        {...(hostListingsApi ? { hostListingsApi } : {})}
        {...(reservationApi ? { reservationApi } : {})}
      />
    </QueryClientProvider>
  );
  const view = render(controller(routeView));

  return {
    ...view,
    queryClient,
    rerenderRoute(nextRouteView: ProfileRouteView) {
      view.rerender(controller(nextRouteView));
    },
  };
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const appliedResult = (
  command: HostListingManagementCommand,
): HostListingManagementResult => ({
  ...command,
  publication: { status: "succeeded" },
  status: "applied",
});

const openListingDialog = async () => {
  await userEvent.click(
    await screen.findByRole("button", {
      name: "남산 숙소 숙소 관리 열기",
    }),
  );

  return screen.getByRole("dialog", { name: "숙소 관리" });
};

describe("ProfileController", () => {
  it("maps the guest route variant through the scoped reservation API", async () => {
    const reservations = createReservationApi();
    const hostListings = createHostListingsApi();
    reservations.getList.mockResolvedValue(
      guestPage([guestReservation("guest-upcoming", "게스트 바다 숙소")]),
    );

    renderController({
      hostListingsApi: hostListings.api,
      reservationApi: reservations.api,
      routeView: {
        activeTab: "upcoming",
        filterType: "UPCOMING",
        variant: "guest",
      },
    });

    expect(await screen.findByText("게스트 바다 숙소")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "다가올 여행" }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("게스트 바다 숙소")).toHaveAttribute(
      "src",
      "https://assets.test/guest-stay.jpg",
    );
    expect(
      screen.getByRole("link", {
        name: "게스트 바다 숙소 예약 상세 보기",
      }),
    ).toHaveAttribute("href", "/reservations/guest-upcoming");
    expect(reservations.getList).toHaveBeenCalledWith(
      "guest",
      { filterType: "UPCOMING", size: 20 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(hostListings.getHostListings).not.toHaveBeenCalled();
  });

  it("maps the host-listings route variant and its status filter", async () => {
    const reservations = createReservationApi();
    const hostListings = createHostListingsApi();

    renderController({
      hostListingsApi: hostListings.api,
      reservationApi: reservations.api,
      routeView: { statusType: "PUBLISHED", variant: "host-listings" },
    });

    expect(
      await screen.findByRole("button", {
        name: "남산 숙소 숙소 관리 열기",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("서울, 중구")).toBeInTheDocument();
    expect(hostListings.getHostListings).toHaveBeenCalledWith(
      { size: 20, status: "PUBLISHED" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(reservations.getList).not.toHaveBeenCalled();
  });

  it("maps host reservations and toggles check-in sorting in controller state", async () => {
    const reservations = createReservationApi();
    const hostListings = createHostListingsApi();
    reservations.getList.mockResolvedValue(
      hostPage([
        hostReservation({
          checkInDate: "2027-09-01",
          reservationCode: "HOST-EARLY",
          reservationUid: "host-early",
        }),
        hostReservation({
          checkInDate: "2027-09-10",
          reservationCode: "HOST-LATE",
          reservationUid: "host-late",
        }),
      ]),
    );

    renderController({
      hostListingsApi: hostListings.api,
      reservationApi: reservations.api,
      routeView: {
        filterType: "CANCELLED",
        variant: "host-reservations",
      },
    });

    expect(await screen.findByText("HOST-LATE")).toBeInTheDocument();
    const reservationCodes = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getByText(/HOST-(?:EARLY|LATE)/).textContent);

    expect(reservationCodes()).toEqual(["HOST-LATE", "HOST-EARLY"]);
    expect(
      screen.getByRole("columnheader", { name: /체크인/ }),
    ).toHaveAttribute("aria-sort", "descending");

    await userEvent.click(screen.getByRole("button", { name: /체크인/ }));

    expect(reservationCodes()).toEqual(["HOST-EARLY", "HOST-LATE"]);
    expect(
      screen.getByRole("columnheader", { name: /체크인/ }),
    ).toHaveAttribute("aria-sort", "ascending");
    expect(reservations.getList).toHaveBeenCalledWith(
      "host",
      { filterType: "CANCELLED", size: 20 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(hostListings.getHostListings).not.toHaveBeenCalled();
  });

  it("never exposes a late response from the previous route filter", async () => {
    const reservations = createReservationApi();
    const hostListings = createHostListingsApi();
    const upcoming = deferred<ReservationListPage<"guest">>();
    const past = deferred<ReservationListPage<"guest">>();
    reservations.getList.mockImplementation(
      (_audience: "guest" | "host", request: { filterType?: string }) =>
        request.filterType === "UPCOMING" ? upcoming.promise : past.promise,
    );
    const view = renderController({
      hostListingsApi: hostListings.api,
      reservationApi: reservations.api,
      routeView: {
        activeTab: "upcoming",
        filterType: "UPCOMING",
        variant: "guest",
      },
    });

    await waitFor(() => expect(reservations.getList).toHaveBeenCalledTimes(1));
    view.rerenderRoute({
      activeTab: "past",
      filterType: "PAST",
      variant: "guest",
    });
    await waitFor(() => expect(reservations.getList).toHaveBeenCalledTimes(2));

    await act(async () => {
      upcoming.resolve(
        guestPage([
          guestReservation("stale-upcoming", "노출되면 안 되는 예정 숙소"),
        ]),
      );
      await upcoming.promise;
    });

    expect(
      screen.queryByText("노출되면 안 되는 예정 숙소"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    await act(async () => {
      past.resolve(
        guestPage([guestReservation("current-past", "현재 이전 여행 숙소")]),
      );
      await past.promise;
    });

    expect(await screen.findByText("현재 이전 여행 숙소")).toBeInTheDocument();
    expect(
      screen.queryByText("노출되면 안 되는 예정 숙소"),
    ).not.toBeInTheDocument();
  });

  it("keeps the listing dialog open when delete confirmation is cancelled", async () => {
    const hostListings = createHostListingsApi();
    const workflow = createWorkflow();
    const confirmDelete = vi.fn(() => false);
    renderController({
      confirmDelete,
      hostListingsApi: hostListings.api,
      hostListingWorkflow: workflow.workflow,
      routeView: { statusType: "PUBLISHED", variant: "host-listings" },
    });

    await openListingDialog();
    await userEvent.click(screen.getByRole("button", { name: "리스팅 삭제" }));

    expect(confirmDelete).toHaveBeenCalledWith(
      "정말 이 리스팅을 삭제하시겠습니까?",
    );
    expect(workflow.execute).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "숙소 관리" }),
    ).toBeInTheDocument();
  });

  it("allows only one workflow execution for rapid duplicate action clicks", async () => {
    const hostListings = createHostListingsApi();
    const workflow = createWorkflow();
    const command = { action: "unpublish", accommodationId: 41 } as const;
    const pending = deferred<HostListingManagementResult>();
    workflow.execute.mockReturnValue(pending.promise);
    renderController({
      hostListingsApi: hostListings.api,
      hostListingWorkflow: workflow.workflow,
      routeView: { statusType: "PUBLISHED", variant: "host-listings" },
    });

    await openListingDialog();
    const actionButton = screen.getByRole("button", {
      name: "리스팅 비공개",
    });
    act(() => {
      actionButton.click();
      actionButton.click();
    });

    expect(workflow.execute).toHaveBeenCalledTimes(1);
    expect(workflow.execute).toHaveBeenCalledWith(command);
    expect(actionButton).toBeDisabled();

    await act(async () => {
      pending.resolve(appliedResult(command));
      await pending.promise;
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "숙소 관리" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("ignores a late result from a replaced listing workflow", async () => {
    const hostListings = createHostListingsApi();
    const firstWorkflow = createWorkflow();
    const secondWorkflow = createWorkflow();
    const pending = deferred<HostListingManagementResult>();
    const command = { action: "unpublish", accommodationId: 41 } as const;
    firstWorkflow.execute.mockReturnValue(pending.promise);
    secondWorkflow.execute.mockResolvedValue(appliedResult(command));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const renderWithWorkflow = (workflow: HostListingManagementWorkflow) => (
      <QueryClientProvider client={queryClient}>
        <ProfileController
          confirmDelete={vi.fn(() => true)}
          hrefs={profileHrefs}
          hostListingsApi={hostListings.api}
          hostListingWorkflow={workflow}
          navigation={createNavigation()}
          resolveImageUrl={resolveImageUrl}
          routeView={{ statusType: "PUBLISHED", variant: "host-listings" }}
          scope={scope}
        />
      </QueryClientProvider>
    );
    const view = render(renderWithWorkflow(firstWorkflow.workflow));

    await openListingDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "리스팅 비공개" }),
    );
    view.rerender(renderWithWorkflow(secondWorkflow.workflow));

    await act(async () => {
      pending.resolve(appliedResult(command));
      await pending.promise;
    });

    expect(
      screen.getByRole("dialog", { name: "숙소 관리" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "리스팅 비공개" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "숙소 관리" }),
      ).not.toBeInTheDocument(),
    );
    expect(firstWorkflow.execute).toHaveBeenCalledTimes(1);
    expect(secondWorkflow.execute).toHaveBeenCalledTimes(1);
  });

  it("does not apply listing A's late failure to a newly opened listing B", async () => {
    const hostListings = createHostListingsApi();
    hostListings.getHostListings.mockResolvedValue(
      listingPage([listing(), listing({ id: 42, name: "북촌 숙소" })]),
    );
    const workflow = createWorkflow();
    const pending = deferred<HostListingManagementResult>();
    workflow.execute.mockReturnValue(pending.promise);
    renderController({
      hostListingsApi: hostListings.api,
      hostListingWorkflow: workflow.workflow,
      routeView: { statusType: "PUBLISHED", variant: "host-listings" },
    });

    await openListingDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "리스팅 비공개" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "숙소 관리 닫기" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "북촌 숙소 숙소 관리 열기",
      }),
    );

    await act(async () => {
      pending.resolve({
        error: new AppError({
          code: "A002",
          kind: "http",
          message: "forbidden",
          status: 403,
        }),
        status: "definitive-failure",
      });
      await pending.promise;
    });

    expect(screen.getByRole("dialog", { name: "숙소 관리" })).toHaveTextContent(
      "북촌 숙소",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "리스팅 비공개" }),
      ).toBeEnabled(),
    );
  });

  it("keeps the listing context open after a stale workflow result", async () => {
    const hostListings = createHostListingsApi();
    const workflow = createWorkflow();
    workflow.execute.mockResolvedValue({ status: "stale" });
    renderController({
      hostListingsApi: hostListings.api,
      hostListingWorkflow: workflow.workflow,
      routeView: { statusType: "PUBLISHED", variant: "host-listings" },
    });

    await openListingDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "리스팅 비공개" }),
    );

    expect(
      screen.getByRole("dialog", { name: "숙소 관리" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "리스팅 비공개" }),
      ).toBeEnabled(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a failed action in context and closes only after a successful retry", async () => {
    const hostListings = createHostListingsApi();
    const workflow = createWorkflow();
    const command = { action: "unpublish", accommodationId: 41 } as const;
    workflow.execute
      .mockResolvedValueOnce({
        error: new AppError({
          code: "A002",
          kind: "http",
          message: "forbidden",
          status: 403,
        }),
        status: "definitive-failure",
      })
      .mockResolvedValueOnce(appliedResult(command));
    renderController({
      hostListingsApi: hostListings.api,
      hostListingWorkflow: workflow.workflow,
      routeView: { statusType: "PUBLISHED", variant: "host-listings" },
    });

    await openListingDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "리스팅 비공개" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "숙소에 대한 접근 권한이 없습니다.",
    );
    expect(
      screen.getByRole("dialog", { name: "숙소 관리" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "리스팅 비공개" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "숙소 관리" }),
      ).not.toBeInTheDocument(),
    );
    expect(workflow.execute).toHaveBeenCalledTimes(2);
    expect(workflow.execute).toHaveBeenLastCalledWith(command);
  });

  it("keeps an applied action visible when cache publication fails", async () => {
    const hostListings = createHostListingsApi();
    const workflow = createWorkflow();
    workflow.execute.mockResolvedValue({
      action: "unpublish",
      accommodationId: 41,
      publication: {
        error: new AppError({
          code: "CACHE_REFRESH_FAILED",
          kind: "unknown",
          message: "cache unavailable",
        }),
        status: "failed",
      },
      status: "applied",
    });
    renderController({
      hostListingsApi: hostListings.api,
      hostListingWorkflow: workflow.workflow,
      routeView: { statusType: "PUBLISHED", variant: "host-listings" },
    });

    await openListingDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "리스팅 비공개" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "요청은 처리됐지만 목록을 갱신하지 못했습니다. 페이지를 다시 열어 확인해주세요.",
    );
    expect(
      screen.getByRole("dialog", { name: "숙소 관리" }),
    ).toBeInTheDocument();
  });
});
