import {
  useCallback,
  useRef,
  type KeyboardEventHandler,
  type RefObject,
} from "react";
import { useOverlayRegistration } from "./overlayRuntime";

interface UseNonModalOverlayRegistrationOptions {
  readonly enabled: boolean;
  readonly layerRef?: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
  readonly overlayRef: RefObject<HTMLElement | null>;
  readonly restoreFocusOnClose?: boolean;
  readonly triggerRef: RefObject<HTMLElement | null>;
}

export interface NonModalOverlayRegistration {
  readonly isTopmost: boolean;
  readonly onKeyDown: KeyboardEventHandler<HTMLElement>;
  readonly requestCloseOnEscape: () => boolean;
}

const restoreFocus = (triggerRef: RefObject<HTMLElement | null>) => {
  void Promise.resolve().then(() => {
    if (triggerRef.current?.isConnected) triggerRef.current.focus();
  });
};

export const useNonModalOverlayRegistration = ({
  enabled,
  layerRef,
  onClose,
  overlayRef,
  restoreFocusOnClose = true,
  triggerRef,
}: UseNonModalOverlayRegistrationOptions): NonModalOverlayRegistration => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const registration = useOverlayRegistration({
    elementRef: overlayRef,
    enabled,
    layerRef: layerRef ?? overlayRef,
    modality: "non-modal",
    onClose: () => {
      onCloseRef.current();
      if (restoreFocusOnClose) restoreFocus(triggerRef);
    },
    restoreFocusTo: null,
  });

  const requestCloseOnEscape = useCallback(() => {
    if (!enabled || !registration.isTopmostOverall) return false;

    onCloseRef.current();
    if (restoreFocusOnClose) restoreFocus(triggerRef);
    return true;
  }, [
    enabled,
    registration.isTopmostOverall,
    restoreFocusOnClose,
    triggerRef,
  ]);

  const onKeyDown = useCallback<KeyboardEventHandler<HTMLElement>>(
    (event) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        !requestCloseOnEscape()
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    },
    [requestCloseOnEscape],
  );

  return {
    isTopmost: registration.isTopmostOverall,
    onKeyDown,
    requestCloseOnEscape,
  };
};
