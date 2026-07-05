import { ReservationStatus } from "../../../types/enums";
import {
  formatReservationStatus,
  getReservationStatusTone,
  reservationStatusDisplay,
  ReservationStatusTone,
} from "./reservationStatusDisplay";

const statusCases: Array<[ReservationStatus, string, ReservationStatusTone]> = [
  [ReservationStatus.PAYMENT_PENDING, "결제 대기", "warning"],
  [ReservationStatus.PAYMENT_COMPLETED, "결제 완료", "success"],
  [ReservationStatus.CONFIRMED, "확정됨", "success"],
  [ReservationStatus.CANCELLED, "취소됨", "danger"],
  [ReservationStatus.CANCELLATION_FAILED, "취소 실패", "danger"],
  [ReservationStatus.COMPLETED, "이용 완료", "neutral"],
  [ReservationStatus.EXPIRED, "만료됨", "neutral"],
];

describe("reservation status display", () => {
  it("exports display metadata for every reservation status", () => {
    expect(Object.keys(reservationStatusDisplay).sort()).toEqual(
      Object.values(ReservationStatus).sort()
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
