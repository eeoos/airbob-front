import {
  calculateCheckoutNights,
  calculatePayableAmount,
  formatGuestSummary,
} from "./reservationCheckoutSummary";

describe("reservation checkout summary", () => {
  it("calculates nights from selected dates", () => {
    expect(calculateCheckoutNights("2026-07-10", "2026-07-12")).toBe(2);
  });

  it("uses local calendar date semantics across DST fall-back dates", () => {
    const RealDate = Date;
    const dayMs = 1000 * 60 * 60 * 24;
    const fallbackHourMs = 1000 * 60 * 60;
    const createDateLike = (time: number, day: number) =>
      ({
        getDate: () => day,
        getFullYear: () => 2026,
        getMonth: () => 10,
        getTime: () => time,
      }) as Date;
    const dateSpy = jest
      .spyOn(global, "Date")
      .mockImplementation(((...args: unknown[]) => {
        if (args.length === 3 && args[0] === 2026 && args[1] === 10) {
          const day = Number(args[2]);
          return createDateLike(day === 1 ? 0 : dayMs + fallbackHourMs, day);
        }

        if (args.length === 1 && args[0] === "2026-11-01") {
          return new RealDate(0);
        }

        if (args.length === 1 && args[0] === "2026-11-02") {
          return new RealDate(dayMs);
        }

        return new RealDate(...(args as []));
      }) as unknown as DateConstructor);

    try {
      expect(calculateCheckoutNights("2026-11-01", "2026-11-02")).toBe(2);
      expect(dateSpy).toHaveBeenCalledWith(2026, 10, 1);
      expect(dateSpy).toHaveBeenCalledWith(2026, 10, 2);
    } finally {
      dateSpy.mockRestore();
    }
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
