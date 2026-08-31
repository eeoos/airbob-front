import type { Mocked } from "vitest";
import type { SessionQueryScope } from "../../../platform/query/sessionScope";
import type { SessionSubject } from "../../../platform/session/sessionScope";
import type { ReviewReadApiPort } from "../ports/reviewApiPort";
import {
  createAccommodationReviewsQueryOptions,
  REVIEW_PAGE_SIZE,
} from "./reviewQueries";

const scope = {
  subject: "subject:member_7" as SessionSubject,
  epoch: 4,
} satisfies SessionQueryScope;

const api: Mocked<ReviewReadApiPort> = {
  getReviews: vi.fn(),
};

describe("review read query contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("owns a session-scoped list key/meta and forwards the current read contract", async () => {
    const signal = new AbortController().signal;
    const options = createAccommodationReviewsQueryOptions(
      { accommodationId: 31, scope },
      api,
    );
    api.getReviews.mockResolvedValue({
      reviews: [],
      pageInfo: { currentSize: 0, hasNext: false, nextCursor: null },
    });

    await options.queryFn({ pageParam: "cursor-1", signal });

    expect(REVIEW_PAGE_SIZE).toBe(6);
    expect(options.queryKey).toEqual([
      "reviews",
      "accommodation",
      31,
      "LATEST",
      6,
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(options.meta).toEqual({ session: scope });
    expect(api.getReviews).toHaveBeenCalledWith(
      31,
      { cursor: "cursor-1", size: 6, sortType: "LATEST" },
      { signal },
    );
  });

  it("disables a missing accommodation without collapsing its scoped key", () => {
    const options = createAccommodationReviewsQueryOptions(
      { accommodationId: null, scope },
      api,
    );

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
    const options = createAccommodationReviewsQueryOptions(
      { accommodationId: 31, scope },
      api,
    );
    const page = {
      reviews: [],
      pageInfo: {
        currentSize: 0,
        hasNext: true,
        nextCursor: "cursor-1",
      },
    };
    api.getReviews.mockResolvedValue(page);

    await options.queryFn({ pageParam: null, signal });

    expect(api.getReviews).toHaveBeenCalledWith(
      31,
      { size: 6, sortType: "LATEST" },
      { signal },
    );
    expect(
      options.getNextPageParam(
        page,
        [page],
        "cursor-1",
        [null, "cursor-1"],
      ),
    ).toBeUndefined();
  });

  it("produces a distinct key when either subject or epoch changes", () => {
    const base = createAccommodationReviewsQueryOptions(
      { accommodationId: 31, scope },
      api,
    );
    const nextEpoch = createAccommodationReviewsQueryOptions(
      { accommodationId: 31, scope: { ...scope, epoch: 5 } },
      api,
    );
    const nextSubject = createAccommodationReviewsQueryOptions(
      {
        accommodationId: 31,
        scope: {
          ...scope,
          subject: "subject:member_8" as SessionSubject,
        },
      },
      api,
    );

    expect(base.queryKey).not.toEqual(nextEpoch.queryKey);
    expect(base.queryKey).not.toEqual(nextSubject.queryKey);
  });

  it("supports public review reads in an anonymous session generation", () => {
    const anonymousScope = {
      epoch: 6,
      subject: null,
    } satisfies SessionQueryScope;
    const options = createAccommodationReviewsQueryOptions(
      { accommodationId: 31, scope: anonymousScope },
      api,
    );

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
