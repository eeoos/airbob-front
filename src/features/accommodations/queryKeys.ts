import { ReviewSortType } from "../../types/enums";

const reviewAccommodationKeyId = (
  accommodationId: number | string | null | undefined,
) => (accommodationId == null ? "missing" : String(accommodationId));

export const accommodationQueryKeys = {
  all: ["accommodation"] as const,
  detailRoot: ["accommodation", "detail"] as const,
  detail: (accommodationId: number | null, authRefreshIndex: number) =>
    [
      ...accommodationQueryKeys.detailRoot,
      accommodationId ?? "missing",
      authRefreshIndex,
    ] as const,
  couponsRoot: ["accommodation", "coupons"] as const,
  validCoupons: () =>
    [...accommodationQueryKeys.couponsRoot, "valid"] as const,
  reviewsRoot: (accommodationId: number | string | null | undefined) =>
    [
      ...accommodationQueryKeys.all,
      "reviews",
      reviewAccommodationKeyId(accommodationId),
    ] as const,
  reviews: ({
    accommodationId,
    cursor,
    size,
    sortType,
  }: {
    accommodationId: number | string | null | undefined;
    cursor: string | null | undefined;
    size: number;
    sortType: ReviewSortType;
  }) =>
    [
      ...accommodationQueryKeys.reviewsRoot(accommodationId),
      sortType,
      size,
      cursor ?? "first",
    ] as const,
};
