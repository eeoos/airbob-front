import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  OverlayRuntimeContext,
  type OverlayModality,
  type OverlayRegistrationId,
  type OverlayStackRegistration,
  type OverlayStackRuntime,
} from "../../shared/ui/overlayRuntime";
import { useBodyScrollLock } from "../../shared/ui/useBodyScrollLock";

export const APP_OVERLAY_ROOT_ID = "airbob-portal-root";
export const APP_ROOT_ID = "root";

export interface OverlayProviderProps {
  readonly applicationRoot?: HTMLElement;
  readonly children: ReactNode;
  readonly portalRoot?: HTMLElement;
}

interface OverlayStackEntry
  extends Omit<OverlayStackRegistration, "modality" | "restoreFocusTo"> {
  modality: OverlayModality;
  restoreFocusTo: Element | null;
}

interface PendingFocusLineage {
  readonly removedLayer: HTMLElement;
  readonly restoreFocusTo: Element | null;
}

const restoreFocus = (target: Element | null) => {
  if (target instanceof HTMLElement && document.contains(target)) {
    target.focus();
  }
};

const createOverlayStack = (): OverlayStackRuntime & { clear(): void } => {
  const entries: OverlayStackEntry[] = [];
  const listeners = new Set<() => void>();
  let pendingFocusLineage: PendingFocusLineage | null = null;
  let revision = 0;

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const emitMutation = () => {
    revision += 1;
    emit();
  };

  const getTopmostModal = () => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index].modality === "modal") return entries[index];
    }

    return null;
  };

  const restoreFocusAfterStackUpdate = (target: Element | null) => {
    const scheduledRevision = revision;

    void Promise.resolve().then(() => {
      if (revision !== scheduledRevision) return;

      const topmost = entries.at(-1);
      if (!topmost) {
        restoreFocus(target);
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        topmost.element.contains(activeElement)
      ) {
        return;
      }

      if (
        target instanceof HTMLElement &&
        document.contains(target) &&
        topmost.element.contains(target)
      ) {
        target.focus();
        return;
      }

      if (topmost.element.isConnected) topmost.element.focus();
    });
  };

  const rememberFocusLineage = (removed: OverlayStackEntry) => {
    const lineage: PendingFocusLineage = {
      removedLayer: removed.layerElement,
      restoreFocusTo: removed.restoreFocusTo,
    };
    pendingFocusLineage = lineage;

    void Promise.resolve().then(() => {
      if (pendingFocusLineage === lineage) pendingFocusLineage = null;
    });
  };

  const resolveRegistrationFocusTarget = (target: Element | null) => {
    const lineage = pendingFocusLineage;
    pendingFocusLineage = null;
    if (!lineage || !(target instanceof Element)) return target;

    return !target.isConnected || lineage.removedLayer.contains(target)
      ? lineage.restoreFocusTo
      : target;
  };

  const unregister = (id: OverlayRegistrationId) => {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) return;

    const wasTopmost = index === entries.length - 1;
    const [removed] = entries.splice(index, 1);
    pendingFocusLineage = null;

    entries.slice(index).forEach((entry) => {
      if (
        entry.restoreFocusTo &&
        removed.element.contains(entry.restoreFocusTo)
      ) {
        entry.restoreFocusTo = removed.restoreFocusTo;
      }
    });

    if (wasTopmost) rememberFocusLineage(removed);
    emitMutation();
    if (wasTopmost) restoreFocusAfterStackUpdate(removed.restoreFocusTo);
  };

  return {
    getModalSize: () =>
      entries.filter((entry) => entry.modality === "modal").length,
    getTopmostModalId: () => getTopmostModal()?.id ?? null,
    getTopmostId: () => entries.at(-1)?.id ?? null,
    has: (id) => entries.some((entry) => entry.id === id),
    register: (registration) => {
      unregister(registration.id);
      const restoreFocusTo = resolveRegistrationFocusTarget(
        registration.restoreFocusTo,
      );
      const layerParent = registration.layerElement.parentElement;
      if (
        layerParent &&
        layerParent.lastElementChild !== registration.layerElement
      ) {
        const focusedElement = document.activeElement;
        layerParent.appendChild(registration.layerElement);
        if (
          focusedElement instanceof HTMLElement &&
          registration.layerElement.contains(focusedElement)
        ) {
          focusedElement.focus();
        }
      }
      entries.push({
        ...registration,
        modality: registration.modality ?? "modal",
        restoreFocusTo,
      });
      emitMutation();

      let registered = true;
      return () => {
        if (!registered) return;

        registered = false;
        unregister(registration.id);
      };
    },
    requestCloseTopmost: () => {
      const topmost = entries.at(-1);
      if (!topmost) return false;

      topmost.requestClose();
      return true;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear: () => {
      const restoreTarget = entries[0]?.restoreFocusTo ?? null;
      pendingFocusLineage = null;
      if (entries.length === 0) return;

      entries.splice(0, entries.length);
      emitMutation();
      restoreFocusAfterStackUpdate(restoreTarget);
    },
  };
};

const findDocumentPortalRoot = () =>
  typeof document === "undefined"
    ? null
    : document.getElementById(APP_OVERLAY_ROOT_ID);

const findDocumentApplicationRoot = () =>
  typeof document === "undefined"
    ? null
    : document.getElementById(APP_ROOT_ID);

export function OverlayProvider({
  applicationRoot: providedApplicationRoot,
  children,
  portalRoot: providedPortalRoot,
}: OverlayProviderProps) {
  const stackRef = useRef<ReturnType<typeof createOverlayStack> | null>(null);
  if (stackRef.current === null) {
    stackRef.current = createOverlayStack();
  }
  const stack = stackRef.current;
  const ownedPortalRootRef = useRef<HTMLElement | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(
    () => providedPortalRoot ?? findDocumentPortalRoot(),
  );
  const openModalCount = useSyncExternalStore(
    stack.subscribe,
    stack.getModalSize,
    () => 0,
  );
  const applicationRoot =
    providedApplicationRoot ?? findDocumentApplicationRoot();
  const hasOpenModal = openModalCount > 0;

  useBodyScrollLock(hasOpenModal);

  useLayoutEffect(() => {
    if (!applicationRoot || !hasOpenModal) return;

    const previousAriaHidden = applicationRoot.getAttribute("aria-hidden");
    const previousInert = applicationRoot.getAttribute("inert");

    applicationRoot.setAttribute("aria-hidden", "true");
    applicationRoot.setAttribute("inert", "");

    return () => {
      if (previousAriaHidden === null) {
        applicationRoot.removeAttribute("aria-hidden");
      } else {
        applicationRoot.setAttribute("aria-hidden", previousAriaHidden);
      }

      if (previousInert === null) {
        applicationRoot.removeAttribute("inert");
      } else {
        applicationRoot.setAttribute("inert", previousInert);
      }
    };
  }, [applicationRoot, hasOpenModal]);

  useLayoutEffect(() => {
    if (providedPortalRoot) {
      setPortalRoot((current) =>
        current === providedPortalRoot ? current : providedPortalRoot,
      );
      return;
    }

    const existing = findDocumentPortalRoot();
    if (existing) {
      setPortalRoot((current) => (current === existing ? current : existing));
      return;
    }

    const created = document.createElement("div");
    created.id = APP_OVERLAY_ROOT_ID;
    created.dataset.testid = APP_OVERLAY_ROOT_ID;
    document.body.appendChild(created);
    ownedPortalRootRef.current = created;
    setPortalRoot(created);
  }, [providedPortalRoot]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        !stack.requestCloseTopmost()
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [stack]);

  useLayoutEffect(
    () => () => {
      stack.clear();
      const ownedPortalRoot = ownedPortalRootRef.current;
      ownedPortalRootRef.current = null;
      if (ownedPortalRoot?.isConnected) ownedPortalRoot.remove();
    },
    [stack],
  );

  const value = useMemo(
    () => ({ portalRoot, stack }),
    [portalRoot, stack],
  );

  return (
    <OverlayRuntimeContext.Provider value={value}>
      {children}
    </OverlayRuntimeContext.Provider>
  );
}
