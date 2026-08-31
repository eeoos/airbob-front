import React from "react";
import {
  getLimitedTotalPages,
  getPaginationItems,
} from "../lib/pagination";

interface SearchPaginationClassNames {
  container?: string;
  pagination?: string;
  button?: string;
  activeButton?: string;
  ellipsis?: string;
  status?: string;
}

type SearchPaginationVariant = "compact" | "full";

interface SearchPaginationProps {
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  classNames?: SearchPaginationClassNames;
  variant?: SearchPaginationVariant;
}

const classNamesFor = (...classNames: Array<string | undefined>): string =>
  classNames.filter(Boolean).join(" ");

export const SearchPagination: React.FC<SearchPaginationProps> = ({
  currentPage,
  totalPages,
  isLoading,
  onPageChange,
  classNames,
  variant = "full",
}) => {
  if (totalPages <= 1) {
    return null;
  }

  const limitedTotalPages = getLimitedTotalPages(totalPages);
  const previousButton = (
    <button
      type="button"
      className={classNames?.button}
      onClick={() => onPageChange(currentPage - 1)}
      disabled={currentPage === 0 || isLoading}
    >
      이전
    </button>
  );
  const nextButton = (
    <button
      type="button"
      className={classNames?.button}
      onClick={() => onPageChange(currentPage + 1)}
      disabled={currentPage >= limitedTotalPages - 1 || isLoading}
    >
      다음
    </button>
  );

  return (
    <nav className={classNames?.container} aria-label="검색 결과 페이지">
      <div className={classNames?.pagination} data-variant={variant}>
        {previousButton}
        {variant === "compact" ? (
          <span
            className={classNames?.status}
            role="status"
            aria-label={`현재 ${currentPage + 1} / ${limitedTotalPages} 페이지`}
          >
            {currentPage + 1} / {limitedTotalPages}
          </span>
        ) : (
          getPaginationItems({ currentPage, totalPages }).map((page, index) => {
            if (page === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className={classNames?.ellipsis}
                >
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                type="button"
                aria-current={page === currentPage ? "page" : undefined}
                className={classNamesFor(
                  classNames?.button,
                  page === currentPage ? classNames?.activeButton : undefined
                )}
                onClick={() => onPageChange(page)}
                disabled={isLoading}
              >
                {page + 1}
              </button>
            );
          })
        )}
        {nextButton}
      </div>
    </nav>
  );
};
