import type { MyReservationInfo } from "../../../types/reservation";

export interface GuestTripsYearGroup {
  year: number;
  reservations: MyReservationInfo[];
}

const getDateOnlyParts = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
};

export const groupGuestTripsByYear = (
  reservations: MyReservationInfo[]
): GuestTripsYearGroup[] => {
  const grouped = reservations.reduce<Record<number, MyReservationInfo[]>>(
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
