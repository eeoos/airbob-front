import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from "react";

export type OverlayRegistrationId = symbol;

export interface OverlayStackRegistration {
  readonly element: HTMLElement;
  readonly id: OverlayRegistrationId;
  readonly layerElement: HTMLElement;
  readonly requestClose: () => void;
  readonly restoreFocusTo: Element | null;
}

export interface OverlayStackRuntime {
  readonly getSize: () => number;
  readonly getTopmostId: () => OverlayRegistrationId | null;
  readonly register: (registration: OverlayStackRegistration) => () => void;
  readonly requestCloseTopmost: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
}

export interface OverlayRuntimeValue {
  readonly portalRoot: HTMLElement | null;
  readonly stack: OverlayStackRuntime;
}

export const OverlayRuntimeContext = createContext<OverlayRuntimeValue | null>(
  null,
);

const subscribeToNothing = () => () => undefined;
const getNoTopmostOverlay = () => null;

interface UseOverlayRegistrationOptions {
  readonly elementRef: RefObject<HTMLElement | null>;
  readonly enabled: boolean;
  readonly layerRef: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
  readonly restoreFocusTo: Element | null;
}

export const useOverlayRegistration = ({
  elementRef,
  enabled,
  layerRef,
  onClose,
  restoreFocusTo,
}: UseOverlayRegistrationOptions) => {
  const runtime = useContext(OverlayRuntimeContext);
  const registrationIdRef = useRef<OverlayRegistrationId>(Symbol("overlay"));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const topmostId = useSyncExternalStore(
    runtime?.stack.subscribe ?? subscribeToNothing,
    runtime?.stack.getTopmostId ?? getNoTopmostOverlay,
    getNoTopmostOverlay,
  );

  useLayoutEffect(() => {
    const element = elementRef.current;
    const layerElement = layerRef.current;
    if (!runtime || !enabled || !element || !layerElement) return;

    return runtime.stack.register({
      element,
      id: registrationIdRef.current,
      layerElement,
      requestClose: () => onCloseRef.current(),
      restoreFocusTo,
    });
  }, [elementRef, enabled, layerRef, restoreFocusTo, runtime]);

  return {
    hasRuntime: runtime !== null,
    isTopmost:
      runtime === null || topmostId === registrationIdRef.current,
    portalRoot: runtime?.portalRoot ?? null,
  };
};

export const useOverlayPortalRoot = () =>
  useContext(OverlayRuntimeContext)?.portalRoot ?? null;
