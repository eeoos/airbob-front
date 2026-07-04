const parseCheckoutDate = (dateString: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const calculateCheckoutNights = (checkIn: string, checkOut: string) => {
  const start = parseCheckoutDate(checkIn);
  const end = parseCheckoutDate(checkOut);
  if (!start || !end) {
    return 0;
  }

  const nights = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  return Number.isFinite(nights) ? Math.max(0, nights) : 0;
};

export const calculatePayableAmount = (
  totalAmount: number,
  couponDiscountAmount = 0,
) => Math.max(0, totalAmount - couponDiscountAmount);

export const formatGuestSummary = ({
  adultOccupancy = 0,
  childOccupancy = 0,
  infantOccupancy = 0,
  petOccupancy = 0,
}: {
  adultOccupancy?: number;
  childOccupancy?: number;
  infantOccupancy?: number;
  petOccupancy?: number;
}) => {
  const guestCount = adultOccupancy + childOccupancy;
  const parts = [
    guestCount > 0 && `성인 ${guestCount}명`,
    infantOccupancy > 0 && `유아 ${infantOccupancy}명`,
    petOccupancy > 0 && `반려동물 ${petOccupancy}마리`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "성인 1명";
};
