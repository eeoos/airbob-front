import React from "react";
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
