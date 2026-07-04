import { ReservationStatus } from "../../../types/enums";
import {
  canCreateReview,
  formatBankName,
  formatPaymentStatus,
  formatReservationDetailDate,
  formatReservationDetailTime,
} from "./reservationDetailDisplay";

describe("reservation detail display", () => {
  it("maps numeric bank codes and payment status labels", () => {
    expect(formatBankName("04")).toBe("KB국민은행");
    expect(formatBankName("20")).toBe("우리은행");
    expect(formatBankName("88")).toBe("신한은행");
    expect(formatBankName("UNKNOWN")).toBe("은행코드 UNKNOWN");
    expect(formatPaymentStatus("DONE")).toBe("결제 완료");
    expect(formatPaymentStatus("WAITING_FOR_DEPOSIT")).toBe("입금 대기");
  });

  it("allows review creation only after confirmed checkout when review writing is enabled", () => {
    const now = new Date("2026-07-12T12:00:00");

    expect(
      canCreateReview({
        can_write_review: true,
        check_out_date_time: "2026-07-12T11:00:00",
        check_out_time: "11:00",
        now,
        status: ReservationStatus.CONFIRMED,
      }),
    ).toBe(true);
    expect(
      canCreateReview({
        can_write_review: false,
        check_out_date_time: "2026-07-12T11:00:00",
        check_out_time: "11:00",
        now,
        status: ReservationStatus.CONFIRMED,
      }),
    ).toBe(false);
    expect(
      canCreateReview({
        can_write_review: true,
        check_out_date_time: "2026-07-12T11:00:00",
        check_out_time: "11:00",
        now,
        status: ReservationStatus.COMPLETED,
      }),
    ).toBe(false);
    expect(
      canCreateReview({
        can_write_review: true,
        check_out_date_time: "2026-07-13T11:00:00",
        check_out_time: "11:00",
        now,
        status: ReservationStatus.CONFIRMED,
      }),
    ).toBe(false);
  });

  it("preserves guest reservation date and time labels", () => {
    expect(formatReservationDetailDate("2026-07-10T15:00:00")).toBe(
      "7월 10일 (금)",
    );
    expect(formatReservationDetailTime("15:00")).toBe("오후 3:00");
  });
});
