import {
  formatRecentlyViewedDate,
  groupRecentlyViewedByDate,
} from "./recentlyViewedGroups";

interface RecentlyViewedTestItem {
  accommodationId: number;
  viewedAt: string;
}

const createRecentlyViewed = (
  id: number,
  viewedAt: string,
): RecentlyViewedTestItem => ({
  accommodationId: id,
  viewedAt,
});

describe("recently viewed groups", () => {
  const now = new Date("2026-07-03T12:00:00+09:00");

  it("formats today, yesterday, recent days, and older dates", () => {
    expect(
      formatRecentlyViewedDate("2026-07-03T01:00:00+09:00", now)
    ).toBe("오늘");
    expect(
      formatRecentlyViewedDate("2026-07-02T12:00:00+09:00", now)
    ).toBe("어제");
    expect(
      formatRecentlyViewedDate("2026-06-30T12:00:00+09:00", now)
    ).toBe("3일 전");
    expect(
      formatRecentlyViewedDate("2026-06-20T12:00:00+09:00", now)
    ).toBe("2026년 6월 20일");
  });

  it("groups recently viewed items by formatted date while preserving item order", () => {
    const groups = groupRecentlyViewedByDate(
      [
        createRecentlyViewed(1, "2026-07-03T01:00:00+09:00"),
        createRecentlyViewed(2, "2026-07-02T12:00:00+09:00"),
        createRecentlyViewed(3, "2026-07-03T09:00:00+09:00"),
      ],
      now
    );

    expect(Object.keys(groups)).toEqual(["오늘", "어제"]);
    expect(groups["오늘"].map((item) => item.accommodationId)).toEqual([1, 3]);
    expect(groups["어제"].map((item) => item.accommodationId)).toEqual([2]);
  });
});
