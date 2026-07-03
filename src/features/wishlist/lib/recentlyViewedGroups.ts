import { RecentlyViewedAccommodationInfo } from "../../../types/recentlyViewed";

export type RecentlyViewedGroups = Record<
  string,
  RecentlyViewedAccommodationInfo[]
>;

export const formatRecentlyViewedDate = (
  viewedAt: string,
  now = new Date()
): string => {
  const viewedDate = new Date(viewedAt);
  const diffTime = now.getTime() - viewedDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "오늘";
  }

  if (diffDays === 1) {
    return "어제";
  }

  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  return viewedDate.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const groupRecentlyViewedByDate = (
  items: RecentlyViewedAccommodationInfo[],
  now = new Date()
) =>
  items.reduce<RecentlyViewedGroups>((groups, item) => {
    const date = formatRecentlyViewedDate(item.viewed_at, now);

    if (!groups[date]) {
      groups[date] = [];
    }

    groups[date].push(item);
    return groups;
  }, {});
