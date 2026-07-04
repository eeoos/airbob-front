import { PaymentStatus, ReservationStatus } from "../../../types/enums";

const BANK_NAMES: Record<string, string> = {
  "20": "우리은행",
  "88": "신한은행",
  "04": "KB국민은행",
  "03": "기업은행",
  "11": "NH농협은행",
  "23": "SC제일은행",
  "27": "한국씨티은행",
  "07": "수협은행",
  "37": "전북은행",
  "39": "경남은행",
  "34": "광주은행",
  "32": "부산은행",
  "45": "새마을금고",
  "48": "신협",
  "50": "저축은행",
  "71": "우체국",
  "81": "하나은행",
  "89": "케이뱅크",
  "90": "카카오뱅크",
  "92": "토스뱅크",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  [PaymentStatus.READY]: "결제 대기",
  [PaymentStatus.IN_PROGRESS]: "결제 진행 중",
  [PaymentStatus.WAITING_FOR_DEPOSIT]: "입금 대기",
  [PaymentStatus.DONE]: "결제 완료",
  [PaymentStatus.CANCELED]: "결제 취소",
  [PaymentStatus.EXPIRED]: "결제 만료",
};

const isCheckoutCompleted = (
  checkOutDateTime: string,
  checkOutTime: string,
  now = new Date(),
): boolean => {
  const checkout = new Date(checkOutDateTime);
  const checkoutDate = new Date(
    checkout.getFullYear(),
    checkout.getMonth(),
    checkout.getDate(),
  );
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (checkoutDate < todayDate) {
    return true;
  }

  if (checkoutDate.getTime() === todayDate.getTime()) {
    const [hours, minutes] = checkOutTime.split(":").map(Number);
    const checkoutTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
    );
    return checkoutTime < now;
  }

  return false;
};

export const formatBankName = (bankCode?: string | null) => {
  if (!bankCode) return "-";
  return BANK_NAMES[bankCode] ?? `은행코드 ${bankCode}`;
};

export const formatPaymentStatus = (status?: string | null) => {
  if (!status) return "-";
  return PAYMENT_STATUS_LABELS[status] ?? status;
};

export const formatReservationDetailDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = date.toLocaleDateString("ko-KR", { weekday: "short" });

  return `${month}월 ${day}일 (${weekday})`;
};

export const formatReservationDetailTime = (timeString: string): string => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? "오전" : "오후";

  return `${ampm} ${hour12}:${minutes.toString().padStart(2, "0")}`;
};

export const canCreateReview = ({
  can_write_review,
  check_out_date_time,
  check_out_time,
  now,
  status,
}: {
  can_write_review?: boolean | null;
  check_out_date_time: string;
  check_out_time: string;
  now?: Date;
  status: ReservationStatus;
}) =>
  isCheckoutCompleted(check_out_date_time, check_out_time, now) &&
  status === ReservationStatus.CONFIRMED &&
  Boolean(can_write_review);
