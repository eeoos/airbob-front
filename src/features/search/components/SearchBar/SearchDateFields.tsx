import React from "react";
import styles from "./SearchBar.module.css";

interface SearchDateFieldsProps {
  checkIn: Date | null;
  checkOut: Date | null;
  isExpanded: boolean;
  isOpen: boolean;
  leadingLabel?: string;
  onTriggerClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
}

const formatDisplayDate = (date: Date | null): string => {
  if (!date) return "";
  const month = date.toLocaleDateString("ko-KR", { month: "long" });
  const day = date.getDate();
  return `${month} ${day}일`;
};

const formatCompactDate = (date: Date | null): string => {
  if (!date) return "";
  const month = date.toLocaleDateString("ko-KR", { month: "short" });
  const day = date.getDate();
  return `${month} ${day}일`;
};

const formatDateRange = (checkIn: Date | null, checkOut: Date | null) => {
  if (checkIn && checkOut) {
    return `${formatCompactDate(checkIn)} - ${formatCompactDate(checkOut)}`;
  }

  if (checkIn) return `${formatCompactDate(checkIn)} - 날짜 추가`;
  if (checkOut) return `날짜 추가 - ${formatCompactDate(checkOut)}`;
  return "날짜 추가";
};

export const SearchDateFields = ({
  checkIn,
  checkOut,
  isExpanded,
  isOpen,
  leadingLabel,
  onTriggerClick,
  triggerRef,
}: SearchDateFieldsProps) => (
  <button
    ref={triggerRef}
    aria-label={`체크인 ${checkIn ? formatDisplayDate(checkIn) : "미정"}, 체크아웃 ${checkOut ? formatDisplayDate(checkOut) : "미정"}`}
    aria-controls="search-date-picker"
    aria-expanded={isOpen}
    aria-haspopup="dialog"
    className={styles.searchItem}
    data-active={isOpen ? "" : undefined}
    onClick={onTriggerClick}
    type="button"
  >
    {leadingLabel && (
      <span className={styles.mobileDateLabel}>{leadingLabel}</span>
    )}
    {isExpanded ? (
      <>
        <div aria-hidden="true" className={styles.dateFields}>
          <div className={styles.label}>날짜</div>
          <div className={styles.value}>
            {formatDateRange(checkIn, checkOut)}
          </div>
        </div>
        <div aria-hidden="true" className={styles.mobileDateValue}>
          {formatDateRange(checkIn, checkOut)}
        </div>
      </>
    ) : (
      <div aria-hidden="true" className={styles.compactValue}>
        {checkIn && checkOut ? formatDateRange(checkIn, checkOut) : "언제든지"}
      </div>
    )}
  </button>
);
