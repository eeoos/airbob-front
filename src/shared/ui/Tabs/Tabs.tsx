import React from "react";
import styles from "./Tabs.module.css";

export interface TabItem<TValue extends string = string> {
  disabled?: boolean;
  id?: string;
  label: React.ReactNode;
  panelId?: string;
  value: TValue;
}

export interface TabsProps<TValue extends string = string> {
  ariaLabel: string;
  className?: string;
  items: ReadonlyArray<TabItem<TValue>>;
  onValueChange: (value: TValue) => void;
  selectedTabClassName?: string;
  tabClassName?: string;
  value: TValue;
  variant?: "line" | "plain";
}

const cx = (...classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(" ");

export function Tabs<TValue extends string = string>({
  ariaLabel,
  className,
  items,
  onValueChange,
  selectedTabClassName,
  tabClassName,
  value,
  variant = "line",
}: TabsProps<TValue>) {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = items.findIndex((item) => item.value === value);

  const selectTabAt = (index: number) => {
    const item = items[index];

    if (!item || item.disabled) {
      return;
    }

    tabRefs.current[index]?.focus();
    onValueChange(item.value);
  };

  const moveSelection = (direction: 1 | -1) => {
    if (items.length === 0) {
      return;
    }

    const activeIndex = tabRefs.current.findIndex(
      (element) => element === document.activeElement
    );
    const startIndex = activeIndex >= 0 ? activeIndex : Math.max(selectedIndex, 0);

    for (let offset = 1; offset <= items.length; offset += 1) {
      const nextIndex =
        (startIndex + direction * offset + items.length) % items.length;
      if (!items[nextIndex]?.disabled) {
        selectTabAt(nextIndex);
        return;
      }
    }
  };

  const selectEdgeTab = (edge: "first" | "last") => {
    const startIndex = edge === "first" ? 0 : items.length - 1;
    const step = edge === "first" ? 1 : -1;

    for (
      let index = startIndex;
      index >= 0 && index < items.length;
      index += step
    ) {
      if (!items[index]?.disabled) {
        selectTabAt(index);
        return;
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectEdgeTab("first");
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectEdgeTab("last");
    }
  };

  return (
    <div
      aria-label={ariaLabel}
      className={cx(styles.tabList, styles[variant], className)}
      role="tablist"
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) => {
        const isSelected = item.value === value;

        return (
          <button
            key={item.value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            aria-controls={item.panelId}
            aria-disabled={item.disabled ? true : undefined}
            aria-selected={isSelected}
            className={cx(
              styles.tab,
              styles[`${variant}Tab`],
              isSelected && styles[`${variant}Selected`],
              tabClassName,
              isSelected && selectedTabClassName
            )}
            disabled={item.disabled}
            id={item.id}
            role="tab"
            tabIndex={isSelected ? 0 : -1}
            type="button"
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
