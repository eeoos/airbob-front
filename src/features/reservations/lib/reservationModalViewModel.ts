import type { AccommodationDetail } from "../../../types/accommodation";

export interface ReservationModalAccommodationViewModel {
  basePrice: number;
  id: number;
  name: string;
  primaryImageUrl: string | null;
  rating: {
    averageRating: number;
    reviewCount: number;
  };
}

export const toReservationModalAccommodationViewModel = (
  accommodation: AccommodationDetail,
): ReservationModalAccommodationViewModel => ({
  basePrice: accommodation.base_price,
  id: accommodation.id,
  name: accommodation.name,
  primaryImageUrl: accommodation.images[0]?.image_url ?? null,
  rating: {
    averageRating: accommodation.review_summary.average_rating,
    reviewCount: accommodation.review_summary.total_count,
  },
});
