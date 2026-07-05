import { RefObject, useEffect, useRef } from "react";

type OutsideClickBoundary = {
  contains: (target: Node) => boolean;
};

export const useOutsideClick = <T extends OutsideClickBoundary>(
  ref: RefObject<T | null>,
  onOutsideClick: (event: PointerEvent) => void,
  enabled = true
) => {
  const onOutsideClickRef = useRef(onOutsideClick);

  useEffect(() => {
    onOutsideClickRef.current = onOutsideClick;
  }, [onOutsideClick]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        !ref.current ||
        !(target instanceof Node) ||
        ref.current.contains(target)
      ) {
        return;
      }

      onOutsideClickRef.current(event);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [enabled, ref]);
};
