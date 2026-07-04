import type { MyReservationInfo } from "../../../types/reservation";

export type GuestTripGroupReservation = Pick<MyReservationInfo, "check_in_date">;

export interface GuestTripsYearGroup<
  TReservation extends GuestTripGroupReservation = MyReservationInfo
> {
  year: number;
  reservations: TReservation[];
}

const getDateOnlyParts = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
};

export const groupGuestTripsByYear = <
  TReservation extends GuestTripGroupReservation
>(
  reservations: TReservation[]
): GuestTripsYearGroup<TReservation>[] => {
  const grouped = reservations.reduce<Record<number, TReservation[]>>(
    (groups, reservation) => {
      const { year } = getDateOnlyParts(reservation.check_in_date);
      return {
        ...groups,
        [year]: [...(groups[year] ?? []), reservation],
      };
    },
    {}
  );

  return Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a)
    .map((year) => ({ year, reservations: grouped[year] }));
};

export const formatGuestTripDateRange = (
  checkIn: string,
  checkOut: string
): string => {
  const { year: checkInYear, month: checkInMonth, day: checkInDay } = getDateOnlyParts(checkIn);
  const { year: checkOutYear, month: checkOutMonth, day: checkOutDay } = getDateOnlyParts(checkOut);

  if (checkInYear === checkOutYear && checkInMonth === checkOutMonth) {
    return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutDay}일`;
  }

  if (checkInYear === checkOutYear) {
    return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutMonth}월 ${checkOutDay}일`;
  }

  return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutYear}년 ${checkOutMonth}월 ${checkOutDay}일`;
};
