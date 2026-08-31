import type {
  ReviewableReservation,
  ReviewableReservationRequestOptions,
} from "../model/reviewableReservation";

export interface ReviewableReservationApiPort {
  getReviewableReservation(
    reservationUid: string,
    options?: ReviewableReservationRequestOptions,
  ): Promise<ReviewableReservation>;
}
