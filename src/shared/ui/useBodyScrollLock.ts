import { useEffect } from "react";

let activeScrollLockCount = 0;
let previousBodyOverflow = "";

export const useBodyScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (!isLocked) {
      return;
    }

    if (activeScrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    activeScrollLockCount += 1;

    return () => {
      activeScrollLockCount = Math.max(0, activeScrollLockCount - 1);

      if (activeScrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
        previousBodyOverflow = "";
      }
    };
  }, [isLocked]);
};
