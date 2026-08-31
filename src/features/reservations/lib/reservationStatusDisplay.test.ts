import type { ReservationStatus } from "../model/reservationRead";
import {
  formatReservationStatus,
  getReservationStatusTone,
  reservationStatusDisplay,
  type ReservationStatusTone,
} from "./reservationStatusDisplay";

const statusCases: Array<[ReservationStatus, string, ReservationStatusTone]> = [
  ["PAYMENT_PENDING", "결제 대기", "warning"],
  ["PAYMENT_COMPLETED", "결제 완료", "success"],
  ["CONFIRMED", "확정됨", "success"],
  ["CANCELLED", "취소됨", "danger"],
  ["CANCELLATION_FAILED", "취소 실패", "danger"],
  ["COMPLETED", "이용 완료", "neutral"],
  ["EXPIRED", "만료됨", "neutral"],
];

describe("reservation status display", () => {
  it("exports display metadata for every reservation status", () => {
    expect(Object.keys(reservationStatusDisplay).sort()).toEqual(
      statusCases.map(([status]) => status).sort(),
    );
  });

  it.each(statusCases)(
    "formats %s with label %s and tone %s",
    (status, label, tone) => {
      expect(formatReservationStatus(status)).toBe(label);
      expect(getReservationStatusTone(status)).toBe(tone);
    }
  );
});
