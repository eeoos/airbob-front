interface AccommodationUnavailableDateRange {
  readonly startDate: string;
  readonly endDateExclusive: string;
}

export interface AccommodationAvailability {
  readonly accommodationId: number;
  readonly bookingWindowStartInclusive: string;
  readonly bookingWindowEndExclusive: string;
  readonly unavailableRanges: readonly AccommodationUnavailableDateRange[];
}
