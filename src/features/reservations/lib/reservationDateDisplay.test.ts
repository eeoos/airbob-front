import { formatKoreanDate, formatKoreanDateTime, formatNullablePrice } from "./reservationDateDisplay";

describe("reservation date display", () => {
  it("formats Korean date and date-time labels", () => {
    expect(formatKoreanDate("2026-07-10")).toBe("2026년 7월 10일");
    expect(formatKoreanDateTime("2026-07-10T15:30:00")).toContain("2026년 7월 10일");
  });

  it("formats nullable payment amounts", () => {
    expect(formatNullablePrice(null)).toBe("-");
    expect(formatNullablePrice(120000)).toBe("₩120,000");
  });
});
