import { useEffect, useRef, useState } from "react";

export const DETAIL_SECTIONS = [
  { id: "accommodation-photos", label: "사진" },
  { id: "accommodation-amenities-title", label: "편의시설" },
  { id: "accommodation-location", label: "위치" },
  { id: "accommodation-reviews", label: "후기" },
] as const;

export function useDetailScrollNavigation(enabled: boolean) {
  const heroRef = useRef<HTMLDivElement>(null);
  const reserveActionRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({
    visible: false,
    showReservation: false,
    activeSection: "accommodation-photos",
  });

  useEffect(() => {
    if (!enabled) return;
    let frame: number | null = null;
    const measure = () => {
      frame = null;
      const height = navigationRef.current?.offsetHeight ?? 0;
      const hero = heroRef.current?.getBoundingClientRect();
      const action = reserveActionRef.current?.getBoundingClientRect();
      const visible = Boolean(hero && hero.bottom <= 0);
      const showReservation = Boolean(
        visible && action && action.bottom <= height,
      );
      const passedSections = DETAIL_SECTIONS.flatMap(({ id }) => {
        const element = document.getElementById(id);
        if (!element) return [];
        const top = element.getBoundingClientRect().top;
        return top <= height + 24 ? [{ id, top }] : [];
      }).sort((a, b) => b.top - a.top);
      const activeSection = passedSections[0]?.id ?? "accommodation-photos";
      setState((current) =>
        current.visible === visible &&
        current.showReservation === showReservation &&
        current.activeSection === activeSection
          ? current
          : { visible, showReservation, activeSection },
      );
    };
    const scheduleMeasure = () => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleMeasure);
    [heroRef.current, reserveActionRef.current, navigationRef.current].forEach(
      (element) => {
        if (element) observer?.observe(element);
      },
    );
    measure();
    window.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [enabled]);

  const navigateToSection = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    element.focus({ preventScroll: true });
  };

  return {
    ...state,
    heroRef,
    reserveActionRef,
    navigationRef,
    navigateToSection,
  };
}
