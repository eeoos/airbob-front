import { createSessionQueryMeta } from "../../../platform/query/sessionScope";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import type {
  ReservationFilterType,
  ReservationReadAudience,
} from "../model/reservationRead";

export interface ReservationListKeyInput {
  readonly filterType: ReservationFilterType;
  readonly size: number;
}

const root = ["reservations", "read"] as const;
const listRoot = [...root, "list"] as const;
const detailRoot = [...root, "detail"] as const;
const unavailableSession = Object.freeze({ session: null });

const sessionKey = (scope: AuthenticatedSessionScope | null) =>
  scope === null ? unavailableSession : createSessionQueryMeta(scope);

export const reservationReadQueryKeys = {
  root,
  listRoot,
  list: (
    scope: AuthenticatedSessionScope | null,
    audience: ReservationReadAudience,
    input: ReservationListKeyInput,
  ) =>
    Object.freeze([
      ...listRoot,
      audience,
      Object.freeze({ filterType: input.filterType, size: input.size }),
      sessionKey(scope),
    ] as const),
  detailRoot,
  detail: (
    scope: AuthenticatedSessionScope | null,
    audience: ReservationReadAudience,
    reservationUid: string | null,
  ) =>
    Object.freeze([
      ...detailRoot,
      audience,
      reservationUid,
      sessionKey(scope),
    ] as const),
};
