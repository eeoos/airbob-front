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
}

interface SearchPaginationProps {
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  classNames?: SearchPaginationClassNames;
}

const classNamesFor = (...classNames: Array<string | undefined>): string =>
  classNames.filter(Boolean).join(" ");

export const SearchPagination: React.FC<SearchPaginationProps> = ({
  currentPage,
  totalPages,
  isLoading,
  onPageChange,
  classNames,
}) => {
  if (totalPages <= 1) {
    return null;
  }

  const limitedTotalPages = getLimitedTotalPages(totalPages);

  return (
    <nav className={classNames?.container} aria-label="검색 결과 페이지">
      <div className={classNames?.pagination}>
        <button
          type="button"
          className={classNames?.button}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0 || isLoading}
        >
          이전
        </button>
        {getPaginationItems({ currentPage, totalPages }).map((page, index) => {
          if (page === "ellipsis") {
            return (
              <span key={`ellipsis-${index}`} className={classNames?.ellipsis}>
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
        })}
        <button
          type="button"
          className={classNames?.button}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= limitedTotalPages - 1 || isLoading}
        >
          다음
        </button>
      </div>
    </nav>
  );
};
