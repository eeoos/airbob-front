import type { CheckoutData } from "../../workflows/booking-payment/checkout";
import type { ReservationConfirmCheckoutView } from "./ReservationConfirmScreen";

const parseCalendarDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
    ? date
    : null;
};

const formatKoreanDate = (date: Date): string =>
  `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

const guestLabel = (checkout: CheckoutData): string => {
  const parts = [
    checkout.adultOccupancy > 0 ? `성인 ${checkout.adultOccupancy}명` : null,
    checkout.childOccupancy > 0 ? `어린이 ${checkout.childOccupancy}명` : null,
    checkout.infantOccupancy > 0 ? `유아 ${checkout.infantOccupancy}명` : null,
    checkout.petOccupancy > 0 ? `반려동물 ${checkout.petOccupancy}마리` : null,
  ];

  return parts.filter((part): part is string => part !== null).join(", ");
};

export const toReservationConfirmCheckoutView = (
  checkout: CheckoutData,
  nightlyPrice: number,
): ReservationConfirmCheckoutView => {
  const checkIn = parseCalendarDate(checkout.checkIn);
  const checkOut = parseCalendarDate(checkout.checkOut);
  const nights =
    checkIn && checkOut
      ? Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000)
      : 0;
  const totalPrice = nightlyPrice * Math.max(nights, 0);
  const derivedDiscount = Math.max(totalPrice - checkout.amount, 0);
  const discountAmount =
    derivedDiscount > 0 ? derivedDiscount : (checkout.couponDiscount ?? 0);
  const cancellationDeadline = checkIn
    ? new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate() - 1)
    : null;

  return {
    cancellationDeadlineLabel: cancellationDeadline
      ? cancellationDeadline.toLocaleDateString("ko-KR", {
          month: "long",
          day: "numeric",
        })
      : null,
    coupon:
      discountAmount > 0 ? { discountAmount, name: checkout.couponName } : null,
    dateLabel:
      checkIn && checkOut
        ? `${formatKoreanDate(checkIn)}~${formatKoreanDate(checkOut)}`
        : "",
    guestLabel: guestLabel(checkout),
    nights: Math.max(nights, 0),
    payableAmount: checkout.amount,
    totalPrice,
  };
};
