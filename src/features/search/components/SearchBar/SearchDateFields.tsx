import React from "react";
import styles from "./SearchBar.module.css";

interface SearchDateFieldsProps {
  checkIn: Date | null;
  checkOut: Date | null;
  isExpanded: boolean;
  isOpen: boolean;
  onTriggerClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onTriggerMouseDown: () => void;
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

export const SearchDateFields = ({
  checkIn,
  checkOut,
  isExpanded,
  isOpen,
  onTriggerClick,
  onTriggerMouseDown,
}: SearchDateFieldsProps) => (
  <button
    aria-controls="search-date-picker"
    aria-expanded={isOpen}
    className={styles.searchItem}
    onMouseDown={onTriggerMouseDown}
    onClick={onTriggerClick}
    type="button"
  >
    {isExpanded ? (
      <div className={styles.dateFields}>
        <div className={styles.dateField}>
          <div className={styles.label}>체크인</div>
          <div className={styles.value}>
            {checkIn ? formatDisplayDate(checkIn) : "날짜 추가"}
          </div>
        </div>
        <div className={styles.dateField}>
          <div className={styles.label}>체크아웃</div>
          <div className={styles.value}>
            {checkOut ? formatDisplayDate(checkOut) : "날짜 추가"}
          </div>
        </div>
      </div>
    ) : (
      <div className={styles.compactValue}>
        {checkIn && checkOut
          ? `${formatCompactDate(checkIn)} - ${formatCompactDate(checkOut)}`
          : "언제든지"}
      </div>
    )}
  </button>
);
