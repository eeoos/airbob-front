import { useQuery } from "@tanstack/react-query";
import { createSessionQueryMeta } from "../../../platform/query/sessionScope";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { reviewableReservationApi as defaultReviewableReservationApi } from "../api/reviewableReservationApi";
import type { ReviewableReservation } from "../model/reviewableReservation";
import type { ReviewableReservationApiPort } from "../ports/reviewableReservationApiPort";
import { reviewableReservationQueryKeys } from "./reviewableReservationQueryKeys";

export interface ReviewableReservationQueryOptions {
  readonly reservationUid: string | null;
  readonly scope: AuthenticatedSessionScope | null;
  readonly enabled?: boolean;
}

export const createReviewableReservationQueryOptions = (
  { reservationUid, scope, enabled = true }: ReviewableReservationQueryOptions,
  api: ReviewableReservationApiPort = defaultReviewableReservationApi,
) => ({
  queryKey: reviewableReservationQueryKeys.detail(scope, reservationUid),
  queryFn: ({ signal }: { readonly signal: AbortSignal }) => {
    if (reservationUid === null) {
      throw new TypeError(
        "reservationUid is required for a reviewable reservation query.",
      );
    }
    if (scope === null) {
      throw new TypeError(
        "An authenticated session is required for a reviewable reservation query.",
      );
    }

    return api.getReviewableReservation(reservationUid, { signal });
  },
  enabled: enabled && reservationUid !== null && scope !== null,
  select: (resource: ReviewableReservation): ReviewableReservation | null =>
    reservationUid !== null && resource.reservationUid === reservationUid
      ? resource
      : null,
  ...(scope === null ? {} : { meta: createSessionQueryMeta(scope) }),
  retry: false as const,
  throwOnError: false as const,
});

export const useReviewableReservationReadQuery = (
  options: ReviewableReservationQueryOptions,
) =>
  useQuery<
    ReviewableReservation,
    Error,
    ReviewableReservation | null,
    ReturnType<typeof reviewableReservationQueryKeys.detail>
  >(createReviewableReservationQueryOptions(options));
