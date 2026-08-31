import type { ReservationStatus } from "../model/reservationRead";
import {
  formatReservationStatus,
  getReservationStatusTone,
  type ReservationStatusTone,
} from "./reservationStatusDisplay";

const statusCases: Array<[ReservationStatus, string, ReservationStatusTone]> = [
  ["PAYMENT_PENDING", "결제 대기", "warning"],
  ["PAYMENT_PROCESSING", "결제 처리 중", "warning"],
  ["CONFIRMED", "확정됨", "success"],
  ["CANCELLATION_PENDING", "취소 처리 중", "warning"],
  ["CANCELLED", "취소됨", "danger"],
  ["CANCELLATION_FAILED", "취소 실패", "danger"],
  ["EXPIRED", "만료됨", "neutral"],
];

describe("reservation status display", () => {
  it.each(statusCases)(
    "formats %s with label %s and tone %s",
    (status, label, tone) => {
      expect(formatReservationStatus(status)).toBe(label);
      expect(getReservationStatusTone(status)).toBe(tone);
    },
  );
});
