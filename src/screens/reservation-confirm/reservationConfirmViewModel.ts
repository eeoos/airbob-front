import type { BookingTransactionSnapshot } from "../../workflows/booking-payment/transaction/booking";
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

const guestLabel = (snapshot: BookingTransactionSnapshot): string => {
  const parts = [
    snapshot.adultCount > 0 ? `성인 ${snapshot.adultCount}명` : null,
    snapshot.childCount > 0 ? `어린이 ${snapshot.childCount}명` : null,
    snapshot.infantCount > 0 ? `유아 ${snapshot.infantCount}명` : null,
    snapshot.petCount > 0 ? `반려동물 ${snapshot.petCount}마리` : null,
  ];

  return parts.filter((part): part is string => part !== null).join(", ");
};

export const toReservationConfirmCheckoutView = (
  snapshot: BookingTransactionSnapshot,
): ReservationConfirmCheckoutView => {
  const checkIn = parseCalendarDate(snapshot.checkIn);
  const checkOut = parseCalendarDate(snapshot.checkOut);
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
      snapshot.discountAmount > 0
        ? {
            discountAmount: snapshot.discountAmount,
            name: snapshot.couponDisplayName,
          }
        : null,
    dateLabel:
      checkIn && checkOut
        ? `${formatKoreanDate(checkIn)}~${formatKoreanDate(checkOut)}`
        : "",
    guestLabel: guestLabel(snapshot),
    nights: snapshot.nights,
    payableAmount: snapshot.amount,
    totalPrice: snapshot.subtotal,
  };
};
