import type { ReservationPaymentStatus } from "../model/reservationRead";

const PAYMENT_STATUS_LABELS: Partial<Record<ReservationPaymentStatus, string>> =
  {
    READY: "결제 대기",
    IN_PROGRESS: "결제 진행 중",
    WAITING_FOR_DEPOSIT: "입금 대기",
    DONE: "결제 완료",
    CANCELED: "결제 취소",
    EXPIRED: "결제 만료",
  };

const PAYMENT_STATUSES = new Set<ReservationPaymentStatus>([
  "READY",
  "IN_PROGRESS",
  "WAITING_FOR_DEPOSIT",
  "DONE",
  "CANCELED",
  "PARTIAL_CANCELED",
  "ABORTED",
  "EXPIRED",
]);

const isPaymentStatus = (status: string): status is ReservationPaymentStatus =>
  PAYMENT_STATUSES.has(status as ReservationPaymentStatus);

export const formatPaymentStatus = (
  status?: ReservationPaymentStatus | string | null,
) => {
  if (!status) return "-";
  if (!isPaymentStatus(status)) return status;

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
  const separatorIndex = timeString.indexOf(":");
  if (separatorIndex <= 0) return timeString;

  const hours = Number(timeString.slice(0, separatorIndex));
  const minutes = Number(
    timeString.slice(separatorIndex + 1, separatorIndex + 3),
  );
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return timeString;
  }

  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? "오전" : "오후";

  return `${ampm} ${hour12}:${minutes.toString().padStart(2, "0")}`;
};
