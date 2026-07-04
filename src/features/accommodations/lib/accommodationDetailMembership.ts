import { AccommodationDetail } from "../../../types/accommodation";

export const clearAccommodationWishlistMembership = (
  accommodation: AccommodationDetail | null
): AccommodationDetail | null =>
  accommodation
    ? {
        ...accommodation,
        is_in_wishlist: false,
      }
    : accommodation;
