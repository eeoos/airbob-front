import { useEffect, useRef } from "react";

export interface DisposableResource {
  dispose(): void;
}

/**
 * Disposes replaced or unmounted resources without destroying the committed
 * instance during React StrictMode's development-only effect replay.
 */
export function useStrictModeSafeDisposable(
  resource: DisposableResource,
): void {
  const committedResourceRef = useRef<DisposableResource | null>(null);

  useEffect(() => {
    committedResourceRef.current = resource;

    return () => {
      if (committedResourceRef.current === resource) {
        committedResourceRef.current = null;
      }

      queueMicrotask(() => {
        if (committedResourceRef.current !== resource) {
          resource.dispose();
        }
      });
    };
  }, [resource]);
}
