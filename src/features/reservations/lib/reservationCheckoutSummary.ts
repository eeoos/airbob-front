export const calculateCheckoutNights = (checkIn: string, checkOut: string) => {
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));

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
