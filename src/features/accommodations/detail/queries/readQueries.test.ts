import type { Mocked } from "vitest";
import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import type { SessionQueryScope } from "../../../../platform/query/sessionScope";
import { testSessionRuntimeLeaseId } from "../../../../test/sessionFixtures";
import type { AccommodationDetail } from "../model/accommodationDetail";
import type { AccommodationAvailability } from "../model/accommodationAvailability";
import type { AccommodationAvailabilityApiPort } from "../ports/accommodationAvailabilityApiPort";
import type { AccommodationDetailApiPort } from "../ports/accommodationDetailApiPort";
import type { AccommodationCouponApiPort } from "../ports/couponApiPort";
import {
  createAccommodationDetailQueryOptions,
  createAccommodationAvailabilityQueryOptions,
  createValidCouponsQueryOptions,
} from "./readQueryOptions";

const authenticatedScope = {
  subject: "subject:member_7",
  epoch: 4,
  runtimeLeaseId: testSessionRuntimeLeaseId,
} as AuthenticatedSessionScope;

const anonymousScope: SessionQueryScope = { subject: null, epoch: 2 };

const detail = (id: number): AccommodationDetail => ({
  id,
  name: `stay-${id}`,
  description: "description",
  type: "HOUSE",
  basePrice: 120000,
  currency: "KRW",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  timeZoneId: "Asia/Seoul",
  isInWishlist: false,
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

const availability = (accommodationId: number): AccommodationAvailability => ({
  accommodationId,
  bookingWindowStartInclusive: "2026-07-10",
  bookingWindowEndExclusive: "2027-07-10",
  unavailableRanges: [],
});

describe("accommodation read query contracts", () => {
  const detailApi: Mocked<AccommodationDetailApiPort> = {
    getDetail: vi.fn(),
  };
  const availabilityApi: Mocked<AccommodationAvailabilityApiPort> = {
    getAvailability: vi.fn(),
  };
  const couponApi: Mocked<AccommodationCouponApiPort> = {
    getValidCoupons: vi.fn(),
    issue: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes detail reads, exposes matching meta, and forwards cancellation", async () => {
    const signal = new AbortController().signal;
    const options = createAccommodationDetailQueryOptions(
      { scope: anonymousScope, accommodationId: 31 },
      detailApi,
    );
    detailApi.getDetail.mockResolvedValue(detail(31));

    await options.queryFn({ signal });

    expect(options.queryKey).toEqual([
      "accommodation",
      "detail",
      31,
      { session: { subject: null, epoch: 2 } },
    ]);
    expect(options.meta).toEqual({ session: anonymousScope });
    expect(detailApi.getDetail).toHaveBeenCalledWith(31, { signal });
    expect(options.retry).toBe(false);
    expect(options.throwOnError).toBe(false);
  });

  it("disables missing resources without inventing an anonymous DTO", () => {
    const options = createAccommodationDetailQueryOptions(
      { scope: anonymousScope, accommodationId: null },
      detailApi,
    );

    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual([
      "accommodation",
      "detail",
      null,
      { session: { subject: null, epoch: 2 } },
    ]);
    expect(() =>
      options.queryFn({ signal: new AbortController().signal }),
    ).toThrow("accommodationId is required");
    expect(detailApi.getDetail).not.toHaveBeenCalled();
  });

  it("suppresses a stale resource that does not match the active route id", () => {
    const options = createAccommodationDetailQueryOptions(
      { scope: authenticatedScope, accommodationId: 31 },
      detailApi,
    );

    expect(options.select(detail(31))).toEqual(detail(31));
    expect(options.select(detail(99))).toBeNull();
  });

  it("normalizes anonymous wishlist membership without changing authenticated resources", () => {
    const anonymousOptions = createAccommodationDetailQueryOptions(
      { scope: anonymousScope, accommodationId: 31 },
      detailApi,
    );
    const authenticatedOptions = createAccommodationDetailQueryOptions(
      { scope: authenticatedScope, accommodationId: 31 },
      detailApi,
    );
    const serverMarkedResource = {
      ...detail(31),
      isInWishlist: true,
    };

    expect(anonymousOptions.select(serverMarkedResource)).toEqual({
      ...serverMarkedResource,
      isInWishlist: false,
    });
    expect(authenticatedOptions.select(serverMarkedResource)).toBe(
      serverMarkedResource,
    );
  });

  it("scopes availability independently, binds identity, and forwards cancellation", async () => {
    const signal = new AbortController().signal;
    const options = createAccommodationAvailabilityQueryOptions(
      { scope: anonymousScope, accommodationId: 31 },
      availabilityApi,
    );
    availabilityApi.getAvailability.mockResolvedValue(availability(31));

    await options.queryFn({ signal });

    expect(options.queryKey).toEqual([
      "accommodation",
      "availability",
      31,
      { session: { subject: null, epoch: 2 } },
    ]);
    expect(options.meta).toEqual({ session: anonymousScope });
    expect(availabilityApi.getAvailability).toHaveBeenCalledWith(31, {
      signal,
    });
    expect(options.select(availability(31))).toEqual(availability(31));
    expect(options.select(availability(99))).toBeNull();
    expect(options.retry).toBe(false);
    expect(options.throwOnError).toBe(false);
  });

  it("keeps a missing availability resource network-inert", () => {
    const options = createAccommodationAvailabilityQueryOptions(
      { scope: anonymousScope, accommodationId: null },
      availabilityApi,
    );

    expect(options.enabled).toBe(false);
    expect(() =>
      options.queryFn({ signal: new AbortController().signal }),
    ).toThrow("accommodationId is required");
    expect(availabilityApi.getAvailability).not.toHaveBeenCalled();
  });

  it("scopes authenticated coupon reads and forwards cancellation", async () => {
    const signal = new AbortController().signal;
    const options = createValidCouponsQueryOptions(
      { scope: authenticatedScope },
      couponApi,
    );
    couponApi.getValidCoupons.mockResolvedValue({ coupons: [] });

    await options.queryFn({ signal });

    expect(options.queryKey).toEqual([
      "accommodation",
      "coupons",
      "valid",
      {
        session: {
          subject: authenticatedScope.subject,
          epoch: authenticatedScope.epoch,
        },
      },
    ]);
    expect(options.meta).toEqual({
      session: {
        epoch: authenticatedScope.epoch,
        subject: authenticatedScope.subject,
      },
    });
    expect(couponApi.getValidCoupons).toHaveBeenCalledWith({ signal });
    expect(options.retry).toBe(false);
    expect(options.throwOnError).toBe(false);
  });

  it("keeps the unconditional coupon hook network-inert while anonymous", () => {
    const options = createValidCouponsQueryOptions(
      { scope: anonymousScope },
      couponApi,
    );

    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual([
      "accommodation",
      "coupons",
      "valid",
      { session: { subject: null, epoch: 2 } },
    ]);
    expect(options.meta).toEqual({ session: anonymousScope });
    expect(couponApi.getValidCoupons).not.toHaveBeenCalled();
  });

  it("preserves explicit disabled policies without changing semantic keys", () => {
    const detailOptions = createAccommodationDetailQueryOptions(
      { scope: anonymousScope, accommodationId: 31, enabled: false },
      detailApi,
    );
    const couponOptions = createValidCouponsQueryOptions(
      { scope: authenticatedScope, enabled: false },
      couponApi,
    );
    const availabilityOptions = createAccommodationAvailabilityQueryOptions(
      { scope: anonymousScope, accommodationId: 31, enabled: false },
      availabilityApi,
    );

    expect(detailOptions.enabled).toBe(false);
    expect(availabilityOptions.enabled).toBe(false);
    expect(couponOptions.enabled).toBe(false);
    expect(detailOptions.queryKey[2]).toBe(31);
    expect(couponOptions.queryKey[2]).toBe("valid");
  });
});
