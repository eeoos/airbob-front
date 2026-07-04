import {
  calculateCheckoutNights,
  calculatePayableAmount,
  formatGuestSummary,
} from "./reservationCheckoutSummary";

describe("reservation checkout summary", () => {
  it("calculates nights from selected dates", () => {
    expect(calculateCheckoutNights("2026-07-10", "2026-07-12")).toBe(2);
  });

  it("formats guests without changing current adult and child display", () => {
    expect(formatGuestSummary({ adultOccupancy: 2, childOccupancy: 1 })).toBe(
      "성인 3명",
    );
  });

  it("subtracts selected coupon discount without going below zero", () => {
    expect(calculatePayableAmount(120000, 30000)).toBe(90000);
    expect(calculatePayableAmount(120000, 150000)).toBe(0);
  });
});
