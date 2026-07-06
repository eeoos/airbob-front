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
};
