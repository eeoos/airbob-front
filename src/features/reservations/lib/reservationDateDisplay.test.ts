import {
  formatKoreanDate,
  formatKoreanDateTime,
  formatKoreanDateWithWeekday,
  formatNullablePrice,
} from "./reservationDateDisplay";

describe("reservation date display", () => {
  it("formats Korean date-only labels from literal calendar parts", () => {
    expect(formatKoreanDate("2026-01-01")).toBe("2026년 1월 1일");
    expect(formatKoreanDate("2026-07-10")).toBe("2026년 7월 10일");
    expect(formatKoreanDate("2026-12-31")).toBe("2026년 12월 31일");
  });

  it("formats Korean date labels from timestamp input", () => {
    expect(formatKoreanDate("2026-07-10T15:30:00")).toBe("2026년 7월 10일");
  });

  it("formats Korean date labels with weekday from date-only and timestamp input", () => {
    expect(formatKoreanDateWithWeekday("2026-07-10")).toBe(
      "2026년 7월 10일 (금)",
    );
    expect(formatKoreanDateWithWeekday("2026-07-10T15:30:00")).toBe(
      "2026년 7월 10일 (금)",
    );
  });

  it("formats Korean date-time labels", () => {
    expect(formatKoreanDateTime("2026-07-10T15:30:00")).toContain("2026년 7월 10일");
  });

  it("formats nullable payment amounts", () => {
    expect(formatNullablePrice(null)).toBe("-");
    expect(formatNullablePrice(120000)).toBe("₩120,000");
  });
});
