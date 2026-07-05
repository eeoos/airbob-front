import {
  calculateCheckoutNightsFromDates,
  calculateCheckoutNights,
  calculatePayableAmount,
  formatGuestSummary,
  parseLocalCheckoutDate,
} from "./reservationCheckoutSummary";

describe("reservation checkout summary", () => {
  it("calculates nights from selected dates", () => {
    expect(calculateCheckoutNights("2026-07-10", "2026-07-12")).toBe(2);
  });

  it("parses checkout dates as local calendar dates", () => {
    const parsed = parseLocalCheckoutDate("2026-11-01");

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(10);
    expect(parsed?.getDate()).toBe(1);
    expect(parsed?.getTime()).toBe(new Date(2026, 10, 1).getTime());
  });

  it("rounds fall-back elapsed hours up like the previous local date calculation", () => {
    const dayMs = 1000 * 60 * 60 * 24;
    const fallbackHourMs = 1000 * 60 * 60;

    expect(
      calculateCheckoutNightsFromDates(
        new Date(0),
        new Date(dayMs + fallbackHourMs),
      ),
    ).toBe(2);
  });

  it("returns zero for invalid checkout dates", () => {
    expect(calculateCheckoutNights("2026-02-30", "2026-03-03")).toBe(0);
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
