import React from "react";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import { useNonModalOverlayRegistration } from "../../../../shared/ui/useNonModalOverlayRegistration";
import styles from "./SearchBar.module.css";

type SearchBarPopoverVariant = "date" | "guest" | "suggestions";

export interface SearchBarPopoverProps
  extends React.HTMLAttributes<HTMLDivElement> {
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  variant: SearchBarPopoverVariant;
}

const variantClassNames: Record<SearchBarPopoverVariant, string> = {
  date: requireCssModuleClass(styles.datePickerContainer),
  guest: requireCssModuleClass(styles.guestPicker),
  suggestions: requireCssModuleClass(styles.suggestions),
};

const variantLabels: Record<SearchBarPopoverVariant, string> = {
  date: "검색 날짜 선택",
  guest: "검색 인원 선택",
  suggestions: "검색 지역 추천",
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
      triggerRef,
      variant,
      ...popoverProps
    },
    ref
  ) => {
    const popoverRef = React.useRef<HTMLDivElement>(null);
    const setPopoverRef = React.useCallback(
      (element: HTMLDivElement | null) => {
        popoverRef.current = element;

        if (typeof ref === "function") {
          ref(element);
        } else if (ref) {
          ref.current = element;
        }
      },
      [ref],
    );
    const overlay = useNonModalOverlayRegistration({
      enabled: true,
      onClose,
      overlayRef: popoverRef,
      triggerRef,
    });

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);

      if (event.defaultPrevented) {
        return;
      }

      overlay.onKeyDown(event);
    };

    return (
      <div
        ref={setPopoverRef}
        aria-label={variantLabels[variant]}
        className={cx(variantClassNames[variant], className)}
        onKeyDownCapture={handleKeyDown}
        role="dialog"
        tabIndex={tabIndex}
        {...popoverProps}
      >
        {children}
      </div>
    );
  }
);

SearchBarPopover.displayName = "SearchBarPopover";
