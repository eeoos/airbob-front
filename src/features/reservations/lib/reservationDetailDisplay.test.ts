import {
  formatPaymentStatus,
  formatReservationDetailDate,
  formatReservationDetailTime,
} from "./reservationDetailDisplay";

describe("reservation detail display", () => {
  it("preserves payment status label coverage", () => {
    expect(formatPaymentStatus("DONE")).toBe("결제 완료");
    expect(formatPaymentStatus("WAITING_FOR_DEPOSIT")).toBe("입금 대기");
    expect(formatPaymentStatus("ABORTED")).toBe("ABORTED");
    expect(formatPaymentStatus("PARTIAL_CANCELED")).toBe("PARTIAL_CANCELED");
    expect(formatPaymentStatus("UNKNOWN_STATUS")).toBe("UNKNOWN_STATUS");
  });

  it("preserves guest reservation date and time labels", () => {
    expect(formatReservationDetailDate("2026-07-10T15:00:00")).toBe(
      "7월 10일 (금)",
    );
    expect(formatReservationDetailTime("15:00")).toBe("오후 3:00");
  });
});
