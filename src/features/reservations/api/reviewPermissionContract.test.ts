import reviewableContract from "./__fixtures__/guest-reservation-reviewable.json";
import { toReservationDetailViewModel } from "../lib/reservationDetailViewModel";
import { toGuestReservationDetail } from "./reservationReadMappers";
import { toReviewableReservation } from "./reviewableReservationMapper";

describe("server review permission contract", () => {
  it.each([true, false])(
    "preserves permission %s in both guest detail and review form reads",
    (canWriteReview) => {
      const wire = { ...reviewableContract, can_write_review: canWriteReview };
      const detail = toGuestReservationDetail(wire);
      const review = toReviewableReservation(wire);

      expect(detail.status).toBe("CANCELLATION_FAILED");
      expect(detail.canWriteReview).toBe(canWriteReview);
      expect(toReservationDetailViewModel(detail).canReview).toBe(
        canWriteReview,
      );
      expect(review.canWriteReview).toBe(canWriteReview);
      expect(review.accommodation).toEqual(detail.accommodation);
      expect(review.reservationUid).toBe(detail.reservationUid);
    },
  );

  it.each([undefined, null, "true", "false", 0, 1])(
    "rejects malformed permission %s instead of treating it as truthy",
    (permission) => {
      const wire = { ...reviewableContract, can_write_review: permission };
      expect(() => toGuestReservationDetail(wire)).toThrow(
        "Reservation read canWriteReview is invalid.",
      );
      expect(() => toReviewableReservation(wire)).toThrow(
        "Reservation read canWriteReview is invalid.",
      );
    },
  );
});
