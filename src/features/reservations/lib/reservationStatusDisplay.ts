import { ReservationStatus } from "../../../types/enums";

export type ReservationStatusTone = "success" | "warning" | "danger" | "neutral";

type ReservationStatusDisplay = {
  classKey: string;
  label: string;
  tone: ReservationStatusTone;
};

const reservationStatusDisplay = {
  [ReservationStatus.PAYMENT_PENDING]: {
    classKey: "payment_pending",
    label: "결제 대기",
    tone: "warning",
  },
  [ReservationStatus.PAYMENT_COMPLETED]: {
    classKey: "payment_completed",
    label: "결제 완료",
    tone: "success",
  },
  [ReservationStatus.CONFIRMED]: {
    classKey: "confirmed",
    label: "확정됨",
    tone: "success",
  },
  [ReservationStatus.CANCELLED]: {
    classKey: "cancelled",
    label: "취소됨",
    tone: "danger",
  },
  [ReservationStatus.CANCELLATION_FAILED]: {
    classKey: "cancellation_failed",
    label: "취소 실패",
    tone: "danger",
  },
  [ReservationStatus.COMPLETED]: {
    classKey: "completed",
    label: "이용 완료",
    tone: "neutral",
  },
  [ReservationStatus.EXPIRED]: {
    classKey: "expired",
    label: "만료됨",
    tone: "neutral",
  },
} satisfies Record<ReservationStatus, ReservationStatusDisplay>;

export const formatReservationStatus = (status: ReservationStatus) =>
  reservationStatusDisplay[status].label;

export const getReservationStatusTone = (status: ReservationStatus) =>
  reservationStatusDisplay[status].tone;

export const getReservationStatusClassKey = (status: ReservationStatus) =>
  reservationStatusDisplay[status].classKey;
