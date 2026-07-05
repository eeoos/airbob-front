import React from "react";
import styles from "./SearchBar.module.css";

type SearchBarPopoverVariant = "date" | "guest" | "suggestions";

export interface SearchBarPopoverProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant: SearchBarPopoverVariant;
  onClose: () => void;
}

const variantClassNames: Record<SearchBarPopoverVariant, string> = {
  date: styles.datePickerContainer,
  guest: styles.guestPicker,
  suggestions: styles.suggestions,
};

const cx = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

export const SearchBarPopover = React.forwardRef<
  HTMLDivElement,
  SearchBarPopoverProps
>(
  (
    {
      children,
      className,
      onClose,
      onKeyDown,
      tabIndex = -1,
      variant,
      ...popoverProps
    },
    ref
  ) => {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);

      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    return (
      <div
        ref={ref}
        className={cx(variantClassNames[variant], className)}
        onKeyDown={handleKeyDown}
        tabIndex={tabIndex}
        {...popoverProps}
      >
        {children}
      </div>
    );
  }
);

SearchBarPopover.displayName = "SearchBarPopover";
