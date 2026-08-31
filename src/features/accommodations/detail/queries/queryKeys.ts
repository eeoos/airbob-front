import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../../platform/query/sessionScope";

const root = ["accommodation"] as const;
const detailRoot = [...root, "detail"] as const;
const availabilityRoot = [...root, "availability"] as const;
const couponsRoot = [...root, "coupons"] as const;

export const accommodationReadQueryKeys = {
  root,
  detailRoot,
  detail: (scope: SessionQueryScope, accommodationId: number | null) =>
    [...detailRoot, accommodationId, createSessionQueryMeta(scope)] as const,
  availabilityRoot,
  availability: (scope: SessionQueryScope, accommodationId: number | null) =>
    [
      ...availabilityRoot,
      accommodationId,
      createSessionQueryMeta(scope),
    ] as const,
  couponsRoot,
  validCoupons: (scope: SessionQueryScope) =>
    [...couponsRoot, "valid", createSessionQueryMeta(scope)] as const,
};
