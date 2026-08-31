import { useInfiniteQuery } from "@tanstack/react-query";
import type { SessionQueryScope } from "../../../platform/query/sessionScope";
import type { SessionSubject } from "../../../platform/session/sessionScope";
import { requireDefined } from "../../../test/assertions";
import { reviewApi } from "../api/reviewApi";
import type { ReviewPage } from "../model";
import { useAccommodationReviewsReadQuery } from "./reviewQueries";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return { ...actual, useInfiniteQuery: vi.fn() };
});

interface CapturedQueryOptions {
  readonly queryKey: readonly unknown[];
  readonly queryFn: (context: {
    readonly pageParam: string | null;
    readonly signal: AbortSignal;
  }) => Promise<unknown>;
  readonly enabled: boolean;
  readonly getNextPageParam: (
    page: ReviewPage,
    allPages: ReviewPage[],
    lastPageParam: string | null,
    allPageParams: (string | null)[],
  ) => string | undefined;
  readonly meta: unknown;
}

const mockUseInfiniteQuery = vi.mocked(useInfiniteQuery);

const getCapturedOptions = (): CapturedQueryOptions =>
  requireDefined(
    mockUseInfiniteQuery.mock.calls.at(-1),
    "useInfiniteQuery call",
  )[0] as unknown as CapturedQueryOptions;

const scope = {
  subject: "subject:member_7" as SessionSubject,
  epoch: 4,
} satisfies SessionQueryScope;

describe("review read query contracts", () => {
  beforeEach(() => {
    mockUseInfiniteQuery.mockReset();
    mockUseInfiniteQuery.mockReturnValue(
      {} as ReturnType<typeof useInfiniteQuery>,
    );
    vi.restoreAllMocks();
  });

  it("owns a session-scoped list key/meta and forwards the current read contract", async () => {
    const signal = new AbortController().signal;
    const getReviews = vi.spyOn(reviewApi, "getReviews").mockResolvedValue({
      reviews: [],
      pageInfo: { currentSize: 0, hasNext: false, nextCursor: null },
    });

    useAccommodationReviewsReadQuery({ accommodationId: 31, scope });
    const options = getCapturedOptions();

    await options.queryFn({ pageParam: "cursor-1", signal });

    expect(options.queryKey).toEqual([
      "reviews",
      "accommodation",
      31,
      "LATEST",
      6,
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(options.meta).toEqual({ session: scope });
    expect(getReviews).toHaveBeenCalledWith(
      31,
      { cursor: "cursor-1", size: 6, sortType: "LATEST" },
      { signal },
    );
  });

  it("disables a missing accommodation without collapsing its scoped key", () => {
    useAccommodationReviewsReadQuery({ accommodationId: null, scope });
    const options = getCapturedOptions();

    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual([
      "reviews",
      "accommodation",
      null,
      "LATEST",
      6,
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(options.meta).toEqual({ session: scope });
  });

  it("omits an absent cursor and stops a repeated backend cursor", async () => {
    const signal = new AbortController().signal;
    const page: ReviewPage = {
      reviews: [],
      pageInfo: {
        currentSize: 0,
        hasNext: true,
        nextCursor: "cursor-1",
      },
    };
    const getReviews = vi
      .spyOn(reviewApi, "getReviews")
      .mockResolvedValue(page);

    useAccommodationReviewsReadQuery({ accommodationId: 31, scope });
    const options = getCapturedOptions();

    await options.queryFn({ pageParam: null, signal });

    expect(getReviews).toHaveBeenCalledWith(
      31,
      { size: 6, sortType: "LATEST" },
      { signal },
    );
    expect(
      options.getNextPageParam(page, [page], "cursor-1", [null, "cursor-1"]),
    ).toBeUndefined();
  });

  it("produces a distinct key when either subject or epoch changes", () => {
    useAccommodationReviewsReadQuery({ accommodationId: 31, scope });
    const base = getCapturedOptions();
    useAccommodationReviewsReadQuery({
      accommodationId: 31,
      scope: { ...scope, epoch: 5 },
    });
    const nextEpoch = getCapturedOptions();
    useAccommodationReviewsReadQuery({
      accommodationId: 31,
      scope: {
        ...scope,
        subject: "subject:member_8" as SessionSubject,
      },
    });
    const nextSubject = getCapturedOptions();

    expect(base.queryKey).not.toEqual(nextEpoch.queryKey);
    expect(base.queryKey).not.toEqual(nextSubject.queryKey);
  });

  it("supports public review reads in an anonymous session generation", () => {
    const anonymousScope = {
      epoch: 6,
      subject: null,
    } satisfies SessionQueryScope;

    useAccommodationReviewsReadQuery({
      accommodationId: 31,
      scope: anonymousScope,
    });
    const options = getCapturedOptions();

    expect(options.queryKey).toEqual([
      "reviews",
      "accommodation",
      31,
      "LATEST",
      6,
      { session: { subject: null, epoch: 6 } },
    ]);
    expect(options.meta).toEqual({ session: anonymousScope });
    expect(options.enabled).toBe(true);
  });
});
