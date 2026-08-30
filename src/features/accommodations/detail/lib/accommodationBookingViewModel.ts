import type { AccommodationDetail } from "../model/accommodationDetail";

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
  basePrice: accommodation.basePrice,
  basePriceLabel: formatBasePriceLabel(
    accommodation.basePrice,
    accommodation.currency,
  ),
  unavailableDates: [...accommodation.unavailableDates],
  guestLimits: {
    maxAdultsAndChildren: accommodation.policy.maxOccupancy,
    maxInfants: accommodation.policy.infantOccupancy,
    maxPets: accommodation.policy.petOccupancy,
  },
});
