import type { ReservationStatus } from "../model/reservationRead";
import type { StatusBadgeTone } from "../../../shared/ui";

export type ReservationStatusTone = StatusBadgeTone;

type ReservationStatusDisplay = {
  label: string;
  tone: ReservationStatusTone;
};

export const reservationStatusDisplay = {
  PAYMENT_PENDING: {
    label: "결제 대기",
    tone: "warning",
  },
  PAYMENT_COMPLETED: {
    label: "결제 완료",
    tone: "success",
  },
  CONFIRMED: {
    label: "확정됨",
    tone: "success",
  },
  CANCELLED: {
    label: "취소됨",
    tone: "danger",
  },
  CANCELLATION_FAILED: {
    label: "취소 실패",
    tone: "danger",
  },
  COMPLETED: {
    label: "이용 완료",
    tone: "neutral",
  },
  EXPIRED: {
    label: "만료됨",
    tone: "neutral",
  },
} satisfies Record<ReservationStatus, ReservationStatusDisplay>;

export const formatReservationStatus = (status: ReservationStatus) =>
  reservationStatusDisplay[status].label;

export const getReservationStatusTone = (status: ReservationStatus) =>
  reservationStatusDisplay[status].tone;
