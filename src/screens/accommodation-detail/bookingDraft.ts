interface BookingRouteCounts {
  readonly adultOccupancy: number;
  readonly childOccupancy: number;
  readonly infantOccupancy: number;
  readonly petOccupancy: number;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

export const parseBookingLocalDate = (value: string): Date | null => {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
};

export const formatBookingLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
  readonly nights: number;
  readonly totalPrice: number;
}

export const deriveBookingDates = ({
  basePrice,
  checkIn,
  checkOut,
  unavailableDates,
}: {
  readonly basePrice: number;
  readonly checkIn?: string;
  readonly checkOut?: string;
  readonly unavailableDates: readonly string[];
}): DerivedBookingDates => {
  const parsedCheckIn = checkIn ? parseBookingLocalDate(checkIn) : null;
  const parsedCheckOut = checkOut ? parseBookingLocalDate(checkOut) : null;

  if (parsedCheckIn && parsedCheckOut && parsedCheckOut > parsedCheckIn) {
    const nights = Math.ceil(
      (parsedCheckOut.getTime() - parsedCheckIn.getTime()) / DAY_MILLISECONDS,
    );
    return {
      checkIn: parsedCheckIn,
      checkOut: parsedCheckOut,
      nights,
      totalPrice: basePrice * nights,
    };
  }

  if (parsedCheckIn) {
    return { checkIn: parsedCheckIn, checkOut: null, nights: 0, totalPrice: 0 };
  }

  const unavailable = new Set(unavailableDates);
  const defaultCheckIn = new Date();
  defaultCheckIn.setHours(0, 0, 0, 0);
  while (unavailable.has(formatBookingLocalDate(defaultCheckIn))) {
    defaultCheckIn.setDate(defaultCheckIn.getDate() + 1);
  }
  const defaultCheckOut = new Date(defaultCheckIn);
  defaultCheckOut.setDate(defaultCheckOut.getDate() + 1);

  return {
    checkIn: defaultCheckIn,
    checkOut: defaultCheckOut,
    nights: 1,
    totalPrice: basePrice,
  };
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
