import type { GuestReservationListItem } from "../model/reservationRead";

export type GuestTripGroupReservation = Pick<
  GuestReservationListItem,
  "checkInDate"
>;

export interface GuestTripsYearGroup<
  TReservation extends GuestTripGroupReservation = GuestReservationListItem,
> {
  year: number;
  reservations: TReservation[];
}

const getDateOnlyParts = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
};

export const groupGuestTripsByYear = <
  TReservation extends GuestTripGroupReservation,
>(
  reservations: readonly TReservation[],
): GuestTripsYearGroup<TReservation>[] => {
  const grouped = new Map<number, TReservation[]>();

  reservations.forEach((reservation) => {
    const { year } = getDateOnlyParts(reservation.checkInDate);
    const yearReservations = grouped.get(year);

    if (yearReservations) {
      yearReservations.push(reservation);
    } else {
      grouped.set(year, [reservation]);
    }
  });

  return Array.from(grouped.entries())
    .sort(([leftYear], [rightYear]) => rightYear - leftYear)
    .map(([year, yearReservations]) => ({
      year,
      reservations: yearReservations,
    }));
};

export const formatGuestTripDateRange = (
  checkIn: string,
  checkOut: string,
): string => {
  const { year: checkInYear, month: checkInMonth, day: checkInDay } =
    getDateOnlyParts(checkIn);
  const { year: checkOutYear, month: checkOutMonth, day: checkOutDay } =
    getDateOnlyParts(checkOut);

  if (checkInYear === checkOutYear && checkInMonth === checkOutMonth) {
    return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutDay}일`;
  }

  if (checkInYear === checkOutYear) {
    return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutMonth}월 ${checkOutDay}일`;
  }

  return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutYear}년 ${checkOutMonth}월 ${checkOutDay}일`;
};
