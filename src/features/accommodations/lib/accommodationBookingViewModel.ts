import type { AccommodationDetail } from "../../../types/accommodation";

export interface AccommodationBookingViewModel {
  basePrice: number;
  basePriceLabel: string;
  unavailableDates: Array<string | Date>;
  guestLimits: {
    maxAdultsAndChildren: number;
    maxInfants: number;
    maxPets: number;
  };
}

const formatBasePriceLabel = (basePrice: number, currency: string): string => {
  if (currency === "KRW") {
    return `₩${basePrice.toLocaleString()}`;
  }

  return `${currency} ${basePrice.toLocaleString()}`;
};

export const toAccommodationBookingViewModel = (
  accommodation: AccommodationDetail,
): AccommodationBookingViewModel => ({
  basePrice: accommodation.base_price,
  basePriceLabel: formatBasePriceLabel(
    accommodation.base_price,
    accommodation.currency,
  ),
  unavailableDates: [...accommodation.unavailable_dates],
  guestLimits: {
    maxAdultsAndChildren: accommodation.policy.max_occupancy,
    maxInfants: accommodation.policy.infant_occupancy,
    maxPets: accommodation.policy.pet_occupancy,
  },
});
