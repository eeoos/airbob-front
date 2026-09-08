import type { ReviewableReservation } from "../model/reviewableReservation";
import type { ReviewableReservationWire } from "./reviewableReservationContracts";

export const toReviewableReservation = (
  wire: ReviewableReservationWire,
): ReviewableReservation => {
  if (typeof wire.can_write_review !== "boolean") {
    throw new TypeError("Reservation read canWriteReview is invalid.");
  }
  return {
    reservationUid: wire.reservation_uid,
    canWriteReview: wire.can_write_review,
    checkInDateTime: wire.check_in_date_time,
    checkOutDateTime: wire.check_out_date_time,
    accommodation: {
      id: wire.accommodation.id,
      name: wire.accommodation.name,
      thumbnailUrl: wire.accommodation.thumbnail_url,
    },
    address: {
      country: wire.address.country,
      state: wire.address.state,
      city: wire.address.city,
      district: wire.address.district,
      street: wire.address.street,
      detail: wire.address.detail,
    },
  };
};
