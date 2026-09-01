import {
  addCalendarLocalDateDays,
  calendarLocalDateToDate,
  calendarNightsBetween,
  formatCalendarLocalDate,
  parseCalendarLocalDateOrdinal,
} from "../../shared/lib/calendarLocalDate";

interface BookingRouteCounts {
  readonly adultOccupancy: number;
  readonly childOccupancy: number;
  readonly infantOccupancy: number;
  readonly petOccupancy: number;
}

export const formatBookingLocalDate = formatCalendarLocalDate;

export const formatBookingDisplayDate = (date: Date | null): string =>
  date
    ? `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(
        2,
        "0",
      )}. ${String(date.getDate()).padStart(2, "0")}.`
    : "";

export interface DerivedBookingDates {
  readonly checkIn: Date | null;
  readonly checkOut: Date | null;
  readonly isStayReady: boolean;
  readonly nights: number;
  readonly selectionState: BookingStaySelectionState;
  readonly totalPrice: number;
}

type BookingStaySelectionState =
  | "availability-unavailable"
  | "fully-booked"
  | "incomplete"
  | "invalid"
  | "outside-window"
  | "ready"
  | "unavailable";

export interface BookingAvailabilitySnapshot {
  readonly bookingWindowStartInclusive: string;
  readonly bookingWindowEndExclusive: string;
  readonly unavailableRanges: readonly {
    readonly startDate: string;
    readonly endDateExclusive: string;
  }[];
}

const isStayDateUnavailable = (
  date: string,
  availability: BookingAvailabilitySnapshot,
): boolean =>
  availability.unavailableRanges.some(
    (range) => date >= range.startDate && date < range.endDateExclusive,
  );

const doesStayOverlapUnavailableRange = (
  checkIn: string,
  checkOut: string,
  availability: BookingAvailabilitySnapshot,
): boolean =>
  availability.unavailableRanges.some(
    (range) => range.startDate < checkOut && range.endDateExclusive > checkIn,
  );

const toDerivedBookingDates = (
  basePrice: number,
  checkIn: string | undefined,
  checkOut: string | undefined,
  selectionState: BookingStaySelectionState,
): DerivedBookingDates => {
  const parsedCheckIn = checkIn ? calendarLocalDateToDate(checkIn) : null;
  const parsedCheckOut = checkOut ? calendarLocalDateToDate(checkOut) : null;
  const parsedNights =
    checkIn && checkOut ? calendarNightsBetween(checkIn, checkOut) : null;
  const nights = parsedNights !== null && parsedNights > 0 ? parsedNights : 0;

  return {
    checkIn: parsedCheckIn,
    checkOut: parsedCheckOut,
    isStayReady: selectionState === "ready",
    nights,
    selectionState,
    totalPrice: nights > 0 ? basePrice * nights : 0,
  };
};

const deriveDefaultBookingDates = (
  basePrice: number,
  availability: BookingAvailabilitySnapshot,
): DerivedBookingDates => {
  let defaultCheckIn = availability.bookingWindowStartInclusive;
  while (
    defaultCheckIn < availability.bookingWindowEndExclusive &&
    isStayDateUnavailable(defaultCheckIn, availability)
  ) {
    const nextDate = addCalendarLocalDateDays(defaultCheckIn, 1);
    if (!nextDate) break;
    defaultCheckIn = nextDate;
  }

  const defaultCheckOut = addCalendarLocalDateDays(defaultCheckIn, 1);
  if (
    defaultCheckIn >= availability.bookingWindowEndExclusive ||
    !defaultCheckOut ||
    defaultCheckOut > availability.bookingWindowEndExclusive
  ) {
    return toDerivedBookingDates(
      basePrice,
      undefined,
      undefined,
      "fully-booked",
    );
  }

  return toDerivedBookingDates(
    basePrice,
    defaultCheckIn,
    defaultCheckOut,
    "ready",
  );
};

export const deriveBookingDates = ({
  basePrice,
  checkIn,
  checkOut,
  availability,
}: {
  readonly basePrice: number;
  readonly checkIn?: string;
  readonly checkOut?: string;
  readonly availability: BookingAvailabilitySnapshot | null;
}): DerivedBookingDates => {
  const hasExplicitCheckIn = checkIn !== undefined;
  const hasExplicitCheckOut = checkOut !== undefined;
  const hasExplicitSelection = hasExplicitCheckIn || hasExplicitCheckOut;

  if (!hasExplicitSelection) {
    return availability
      ? deriveDefaultBookingDates(basePrice, availability)
      : toDerivedBookingDates(
          basePrice,
          undefined,
          undefined,
          "availability-unavailable",
        );
  }

  const checkInOrdinal = parseCalendarLocalDateOrdinal(checkIn);
  const checkOutOrdinal = parseCalendarLocalDateOrdinal(checkOut);
  const displayableCheckIn =
    checkInOrdinal === null ? undefined : (checkIn as string);
  const displayableCheckOut =
    checkOutOrdinal === null ? undefined : (checkOut as string);

  if (
    (hasExplicitCheckIn && checkInOrdinal === null) ||
    (hasExplicitCheckOut && checkOutOrdinal === null)
  ) {
    return toDerivedBookingDates(
      basePrice,
      displayableCheckIn,
      displayableCheckOut,
      "invalid",
    );
  }

  if (!availability) {
    return toDerivedBookingDates(
      basePrice,
      displayableCheckIn,
      displayableCheckOut,
      "availability-unavailable",
    );
  }

  if (
    checkInOrdinal === null ||
    checkOutOrdinal === null ||
    !checkIn ||
    !checkOut
  ) {
    if (
      checkIn &&
      (checkIn < availability.bookingWindowStartInclusive ||
        checkIn >= availability.bookingWindowEndExclusive)
    ) {
      return toDerivedBookingDates(
        basePrice,
        displayableCheckIn,
        displayableCheckOut,
        "outside-window",
      );
    }
    if (checkIn && isStayDateUnavailable(checkIn, availability)) {
      return toDerivedBookingDates(
        basePrice,
        displayableCheckIn,
        displayableCheckOut,
        "unavailable",
      );
    }

    return toDerivedBookingDates(
      basePrice,
      displayableCheckIn,
      displayableCheckOut,
      "incomplete",
    );
  }

  if (checkOutOrdinal <= checkInOrdinal) {
    return toDerivedBookingDates(
      basePrice,
      displayableCheckIn,
      displayableCheckOut,
      "invalid",
    );
  }

  if (
    checkIn < availability.bookingWindowStartInclusive ||
    checkIn >= availability.bookingWindowEndExclusive ||
    checkOut > availability.bookingWindowEndExclusive
  ) {
    return toDerivedBookingDates(
      basePrice,
      checkIn,
      checkOut,
      "outside-window",
    );
  }

  if (doesStayOverlapUnavailableRange(checkIn, checkOut, availability)) {
    return toDerivedBookingDates(basePrice, checkIn, checkOut, "unavailable");
  }

  return toDerivedBookingDates(basePrice, checkIn, checkOut, "ready");
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export interface BookingCounts {
  readonly adultCount: number;
  readonly childCount: number;
  readonly infantCount: number;
  readonly petCount: number;
}

export const normalizeBookingCounts = (
  routeState: Pick<
    BookingRouteCounts,
    "adultOccupancy" | "childOccupancy" | "infantOccupancy" | "petOccupancy"
  >,
  limits: {
    readonly maxOccupancy: number;
    readonly maxInfants: number;
    readonly maxPets: number;
  },
): BookingCounts => ({
  adultCount: clamp(routeState.adultOccupancy, 1, limits.maxOccupancy),
  childCount: clamp(routeState.childOccupancy, 0, limits.maxOccupancy),
  infantCount: clamp(routeState.infantOccupancy, 0, limits.maxInfants),
  petCount: clamp(routeState.petOccupancy, 0, limits.maxPets),
});
