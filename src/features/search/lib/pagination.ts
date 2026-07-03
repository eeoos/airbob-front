export const MAX_SEARCH_PAGE = 15;

export type PaginationItem = number | "ellipsis";

export const getLimitedTotalPages = (
  totalPages: number,
  maxPages = MAX_SEARCH_PAGE
): number => Math.max(0, Math.min(totalPages, maxPages));

export const clampSearchPage = (
  pageParam: string | number | null | undefined,
  maxPages = MAX_SEARCH_PAGE
): number => {
  const parsed =
    typeof pageParam === "number" ? pageParam : parseInt(pageParam ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(parsed, maxPages - 1));
};

export const getPaginationItems = ({
  currentPage,
  totalPages,
  maxPages = MAX_SEARCH_PAGE,
}: {
  currentPage: number;
  totalPages: number;
  maxPages?: number;
}): PaginationItem[] => {
  const maxDisplayPages = getLimitedTotalPages(totalPages, maxPages);

  if (maxDisplayPages <= 0) {
    return [];
  }

  const page = clampSearchPage(currentPage, maxDisplayPages);

  if (maxDisplayPages <= 7) {
    return Array.from({ length: maxDisplayPages }, (_, index) => index);
  }

  if (page <= 3) {
    return [0, 1, 2, 3, 4, "ellipsis", maxDisplayPages - 1];
  }

  if (page >= maxDisplayPages - 4) {
    return [
      0,
      "ellipsis",
      maxDisplayPages - 5,
      maxDisplayPages - 4,
      maxDisplayPages - 3,
      maxDisplayPages - 2,
      maxDisplayPages - 1,
    ];
  }

  return [
    0,
    "ellipsis",
    page - 1,
    page,
    page + 1,
    "ellipsis",
    maxDisplayPages - 1,
  ];
};
