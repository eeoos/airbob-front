import type { AccommodationDetail } from "../model/accommodationDetail";
import type { AccommodationAvailability } from "../model/accommodationAvailability";

export interface AccommodationBookingViewModel {
  basePrice: number;
  basePriceLabel: string;
  availability: {
    selectionWindow: {
      startInclusive: string;
      endExclusive: string;
    } | null;
    disabledRanges: Array<{
      startInclusive: string;
      endExclusive: string;
    }>;
  };
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
  availability: AccommodationAvailability | null,
): AccommodationBookingViewModel => ({
  basePrice: accommodation.basePrice,
  basePriceLabel: formatBasePriceLabel(
    accommodation.basePrice,
    accommodation.currency,
  ),
  availability: {
    selectionWindow: availability
      ? {
          startInclusive: availability.bookingWindowStartInclusive,
          endExclusive: availability.bookingWindowEndExclusive,
        }
      : null,
    disabledRanges:
      availability?.unavailableRanges.map((range) => ({
        startInclusive: range.startDate,
        endExclusive: range.endDateExclusive,
      })) ?? [],
  },
  guestLimits: {
    maxAdultsAndChildren: accommodation.policy.maxOccupancy,
    maxInfants: accommodation.policy.infantOccupancy,
    maxPets: accommodation.policy.petOccupancy,
  },
});
