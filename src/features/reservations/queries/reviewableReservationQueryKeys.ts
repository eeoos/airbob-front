import { createSessionQueryMeta } from "../../../platform/query/sessionScope";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { reservationQueryKeys } from "../queryKeys";

const unavailableSession = Object.freeze({ session: null });
const reviewableRoot = [
  ...reservationQueryKeys.guestReservationsRoot,
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
