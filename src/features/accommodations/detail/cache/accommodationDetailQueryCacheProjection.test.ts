import { QueryClient } from "@tanstack/react-query";
import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../../platform/query/sessionScope";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../../../test/sessionFixtures";
import type { AccommodationDetail } from "../model/accommodationDetail";
import { accommodationReadQueryKeys } from "../queries/queryKeys";
import { createAccommodationDetailQueryCacheProjection } from "./accommodationDetailQueryCacheProjection";

const scopeA = {
  subject: "subject:member_a" as SessionSubject,
  epoch: 3,
  runtimeLeaseId: testSessionRuntimeLeaseId,
} satisfies AuthenticatedSessionScope;
const scopeB = {
  subject: "subject:member_b" as SessionSubject,
  epoch: 4,
  runtimeLeaseId: testSessionRuntimeLeaseId,
} satisfies AuthenticatedSessionScope;
const anonymousScope: SessionQueryScope = { subject: null, epoch: 3 };

const detail = (id: number, isInWishlist: boolean): AccommodationDetail => ({
  id,
  name: `stay-${id}`,
  description: "description",
  type: "HOUSE",
  basePrice: 120000,
  currency: "KRW",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  timeZoneId: "Asia/Seoul",
  isInWishlist,
  addressSummary: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: null,
  },
  coordinate: { latitude: 37.5, longitude: 127.0 },
  host: { id: 9, nickname: "host", thumbnailImageUrl: null },
  policy: { maxOccupancy: 4, infantOccupancy: 1, petOccupancy: 0 },
  amenities: [],
  images: [],
  reviewSummary: { totalCount: 0, averageRating: 0 },
});

const seedDetail = (
  client: QueryClient,
  scope: SessionQueryScope,
  keyAccommodationId: number,
  data: AccommodationDetail,
) => {
  const key = accommodationReadQueryKeys.detail(scope, keyAccommodationId);
  client.setQueryDefaults(key, { meta: createSessionQueryMeta(scope) });
  client.setQueryData(key, data);
  return key;
};

describe("accommodation detail cache projection", () => {
  it("patches only the exact resource in the exact authenticated scope", () => {
    const client = new QueryClient();
    const keyA7 = seedDetail(client, scopeA, 7, detail(7, false));
    const keyA8 = seedDetail(client, scopeA, 8, detail(8, false));
    const keyB7 = seedDetail(client, scopeB, 7, detail(7, false));
    const anonymousKey7 = seedDetail(
      client,
      anonymousScope,
      7,
      detail(7, false),
    );

    createAccommodationDetailQueryCacheProjection(client).membershipReconciled({
      scope: scopeA,
      accommodationId: 7,
      isInAnyWishlist: true,
    });

    expect(client.getQueryData<AccommodationDetail>(keyA7)?.isInWishlist).toBe(
      true,
    );
    expect(client.getQueryData<AccommodationDetail>(keyA8)?.isInWishlist).toBe(
      false,
    );
    expect(client.getQueryData<AccommodationDetail>(keyB7)?.isInWishlist).toBe(
      false,
    );
    expect(
      client.getQueryData<AccommodationDetail>(anonymousKey7)?.isInWishlist,
    ).toBe(false);
  });

  it("does not patch stale payloads stored under a matching key", () => {
    const client = new QueryClient();
    const stale = detail(99, false);
    const key = seedDetail(client, scopeA, 7, stale);

    createAccommodationDetailQueryCacheProjection(client).membershipReconciled({
      scope: scopeA,
      accommodationId: 7,
      isInAnyWishlist: true,
    });

    expect(client.getQueryData(key)).toBe(stale);
  });

  it("preserves references for absent resources and unchanged values", () => {
    const client = new QueryClient();
    const original = detail(7, false);
    const key = seedDetail(client, scopeA, 7, original);
    const projection = createAccommodationDetailQueryCacheProjection(client);

    projection.membershipReconciled({
      scope: scopeA,
      accommodationId: 8,
      isInAnyWishlist: true,
    });
    expect(client.getQueryData(key)).toBe(original);

    projection.membershipReconciled({
      scope: scopeA,
      accommodationId: 7,
      isInAnyWishlist: false,
    });
    expect(client.getQueryData(key)).toBe(original);
  });

  it("invalidates only the exact resource and scope when membership is unknown", () => {
    const client = new QueryClient();
    const keyA7 = seedDetail(client, scopeA, 7, detail(7, false));
    const keyA8 = seedDetail(client, scopeA, 8, detail(8, false));
    const keyB7 = seedDetail(client, scopeB, 7, detail(7, false));

    createAccommodationDetailQueryCacheProjection(
      client,
    ).membershipRefreshRequired({
      scope: scopeA,
      accommodationId: 7,
    });

    expect(client.getQueryState(keyA7)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keyA8)?.isInvalidated).toBe(false);
    expect(client.getQueryState(keyB7)?.isInvalidated).toBe(false);
  });

  it("invalidates the exact scoped detail after an embedded summary changes", () => {
    const client = new QueryClient();
    const keyA7 = seedDetail(client, scopeA, 7, detail(7, false));
    const keyA8 = seedDetail(client, scopeA, 8, detail(8, false));
    const keyB7 = seedDetail(client, scopeB, 7, detail(7, false));

    createAccommodationDetailQueryCacheProjection(client).detailRefreshRequired(
      {
        scope: scopeA,
        accommodationId: 7,
      },
    );

    expect(client.getQueryState(keyA7)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keyA8)?.isInvalidated).toBe(false);
    expect(client.getQueryState(keyB7)?.isInvalidated).toBe(false);
  });

  it("returns the exact detail invalidation promise to publication owners", () => {
    const client = new QueryClient();
    const invalidation = Promise.resolve();
    vi.spyOn(client, "invalidateQueries").mockReturnValue(invalidation);

    const result = createAccommodationDetailQueryCacheProjection(
      client,
    ).detailRefreshRequired({
      scope: scopeA,
      accommodationId: 7,
    });

    expect(result).toBe(invalidation);
    expect(client.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ predicate: expect.any(Function) }),
      { throwOnError: true },
    );
  });

  it("invalidates every canonical detail key only in the requested membership scope", () => {
    const client = new QueryClient();
    const keyA7 = seedDetail(client, scopeA, 7, detail(7, false));
    const keyA8 = seedDetail(client, scopeA, 8, detail(8, false));
    const keyB7 = seedDetail(client, scopeB, 7, detail(7, false));
    const anonymousKey7 = seedDetail(
      client,
      anonymousScope,
      7,
      detail(7, false),
    );

    createAccommodationDetailQueryCacheProjection(
      client,
    ).membershipScopeRefreshRequired({ scope: scopeA });

    expect(keyA7).toEqual(accommodationReadQueryKeys.detail(scopeA, 7));
    expect(keyA8).toEqual(accommodationReadQueryKeys.detail(scopeA, 8));
    expect(client.getQueryState(keyA7)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keyA8)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keyB7)?.isInvalidated).toBe(false);
    expect(client.getQueryState(anonymousKey7)?.isInvalidated).toBe(false);
  });
});
