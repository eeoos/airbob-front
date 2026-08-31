import { createSessionQueryMeta } from "../../../platform/query/sessionScope";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { reservationReadQueryKeys } from "./reservationReadQueryKeys";

const unavailableSession = Object.freeze({ session: null });
const reviewableRoot = [
  ...reservationReadQueryKeys.root,
  "reviewable",
] as const;

export const reviewableReservationQueryKeys = {
  root: reviewableRoot,
  detail: (
    scope: AuthenticatedSessionScope | null,
    reservationUid: string | null,
  ) =>
    Object.freeze([
      ...reviewableRoot,
      reservationUid,
      scope === null ? unavailableSession : createSessionQueryMeta(scope),
    ] as const),
};
