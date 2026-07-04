import type { MyReservationInfo } from "../../../types/reservation";

export interface GuestTripsYearGroup {
  year: number;
  reservations: MyReservationInfo[];
}

export const groupGuestTripsByYear = (
  reservations: MyReservationInfo[]
): GuestTripsYearGroup[] => {
  const grouped = reservations.reduce<Record<number, MyReservationInfo[]>>(
    (groups, reservation) => {
      const year = new Date(reservation.check_in_date).getFullYear();
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
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const checkInYear = checkInDate.getFullYear();
  const checkOutYear = checkOutDate.getFullYear();
  const checkInMonth = checkInDate.getMonth() + 1;
  const checkOutMonth = checkOutDate.getMonth() + 1;
  const checkInDay = checkInDate.getDate();
  const checkOutDay = checkOutDate.getDate();

  if (checkInYear === checkOutYear && checkInMonth === checkOutMonth) {
    return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutDay}일`;
  }

  if (checkInYear === checkOutYear) {
    return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutMonth}월 ${checkOutDay}일`;
  }

  return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutYear}년 ${checkOutMonth}월 ${checkOutDay}일`;
};
