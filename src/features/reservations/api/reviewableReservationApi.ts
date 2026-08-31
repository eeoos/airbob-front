import {
  requestApiData,
  type ApiDataRequest,
} from "../../../platform/http/request";
import type { ReviewableReservationApiPort } from "../ports/reviewableReservationApiPort";
import { encodeOpaquePathSegment } from "../../../platform/http/opaquePathSegment";
import type { ReviewableReservationWire } from "./reviewableReservationContracts";
import { toReviewableReservation } from "./reviewableReservationMapper";

type ReviewableReservationApiTransport = <T>(
  request: ApiDataRequest,
) => Promise<NonNullable<T>>;

const createReviewableReservationApi = (
  request: ReviewableReservationApiTransport,
): ReviewableReservationApiPort => ({
  async getReviewableReservation(reservationUid, options) {
    const reservationUidPathSegment = encodeOpaquePathSegment(reservationUid);
    const wire = await request<ReviewableReservationWire>({
      method: "GET",
      path: `/profile/guest/reservations/${reservationUidPathSegment}`,
      signal: options?.signal,
    });

    return toReviewableReservation(wire);
  },
});

export const reviewableReservationApi =
  createReviewableReservationApi(requestApiData);
