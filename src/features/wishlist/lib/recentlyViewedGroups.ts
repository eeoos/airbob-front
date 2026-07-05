export interface RecentlyViewedGroupable {
  viewedAt: string;
}

export type RecentlyViewedGroups<T extends RecentlyViewedGroupable> = Record<
  string,
  T[]
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

export const groupRecentlyViewedByDate = <
  T extends RecentlyViewedGroupable,
>(
  items: T[],
  now = new Date(),
) =>
  items.reduce<RecentlyViewedGroups<T>>((groups, item) => {
    const date = formatRecentlyViewedDate(item.viewedAt, now);

    if (!groups[date]) {
      groups[date] = [];
    }

    groups[date].push(item);
    return groups;
  }, {});
