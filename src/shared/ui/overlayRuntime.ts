import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from "react";

export type OverlayRegistrationId = symbol;
export type OverlayModality = "modal" | "non-modal";

export interface OverlayStackRegistration {
  readonly element: HTMLElement;
  readonly id: OverlayRegistrationId;
  readonly layerElement: HTMLElement;
  readonly modality?: OverlayModality;
  readonly requestClose: () => void;
  readonly restoreFocusTo: Element | null;
}

export interface OverlayStackRuntime {
  readonly getModalSize: () => number;
  readonly getTopmostModalId: () => OverlayRegistrationId | null;
  readonly getTopmostId: () => OverlayRegistrationId | null;
  readonly has: (id: OverlayRegistrationId) => boolean;
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
const getFalse = () => false;
const getNoTopmostOverlay = () => null;
const OverlayPortalTargetContext = createContext<
  HTMLElement | null | undefined
>(undefined);
export const OverlayPortalTargetProvider = OverlayPortalTargetContext.Provider;

interface UseOverlayRegistrationOptions {
  readonly elementRef: RefObject<HTMLElement | null>;
  readonly enabled: boolean;
  readonly layerRef: RefObject<HTMLElement | null>;
  readonly modality?: OverlayModality;
  readonly onClose: () => void;
  readonly restoreFocusRef?: RefObject<Element | null>;
  readonly restoreFocusTo: Element | null;
}

export const useOverlayRegistration = ({
  elementRef,
  enabled,
  layerRef,
  modality = "modal",
  onClose,
  restoreFocusRef,
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
  const topmostModalId = useSyncExternalStore(
    runtime?.stack.subscribe ?? subscribeToNothing,
    runtime?.stack.getTopmostModalId ?? getNoTopmostOverlay,
    getNoTopmostOverlay,
  );
  const isRegistered = useSyncExternalStore(
    runtime?.stack.subscribe ?? subscribeToNothing,
    runtime ? () => runtime.stack.has(registrationIdRef.current) : getFalse,
    getFalse,
  );

  useLayoutEffect(() => {
    const element = elementRef.current;
    const layerElement = layerRef.current;
    if (!runtime || !enabled || !element || !layerElement) return;

    return runtime.stack.register({
      element,
      id: registrationIdRef.current,
      layerElement,
      modality,
      requestClose: () => onCloseRef.current(),
      restoreFocusTo: restoreFocusRef?.current ?? restoreFocusTo,
    });
  }, [
    elementRef,
    enabled,
    layerRef,
    modality,
    restoreFocusRef,
    restoreFocusTo,
    runtime,
  ]);

  return {
    hasRuntime: runtime !== null,
    isRegistered,
    isTopmostOverall:
      runtime === null || topmostId === registrationIdRef.current,
    isTopmostModal:
      runtime === null || topmostModalId === registrationIdRef.current,
    portalRoot: runtime?.portalRoot ?? null,
  };
};

export const useOverlayPortalTarget = () => {
  const scopedTarget = useContext(OverlayPortalTargetContext);
  const sharedTarget = useContext(OverlayRuntimeContext)?.portalRoot ?? null;

  return scopedTarget === undefined ? sharedTarget : scopedTarget;
};
