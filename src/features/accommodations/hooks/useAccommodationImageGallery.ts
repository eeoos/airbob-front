import { useCallback, useEffect, useState } from "react";
import type { TouchEvent } from "react";

interface UseAccommodationImageGalleryOptions {
  imageCount: number;
  minSwipeDistance?: number;
}

const DEFAULT_MIN_SWIPE_DISTANCE = 50;

const clampImageIndex = (index: number, maxIndex: number) =>
  Math.min(Math.max(index, 0), maxIndex);

export function useAccommodationImageGallery({
  imageCount,
  minSwipeDistance = DEFAULT_MIN_SWIPE_DISTANCE,
}: UseAccommodationImageGalleryOptions) {
  const maxImageIndex = Math.max(imageCount - 1, 0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mobileSlideIndex, setMobileSlideIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);

  useEffect(() => {
    setCurrentImageIndex((index) => clampImageIndex(index, maxImageIndex));
    setMobileSlideIndex((index) => clampImageIndex(index, maxImageIndex));
  }, [maxImageIndex]);

  const openGallery = useCallback(
    (index: number) => {
      setCurrentImageIndex(clampImageIndex(index, maxImageIndex));
      setIsImageGalleryOpen(true);
    },
    [maxImageIndex]
  );

  const closeGallery = useCallback(() => {
    setIsImageGalleryOpen(false);
  }, []);

  const handleMobileSlideIndexChange = useCallback(
    (index: number) => {
      setMobileSlideIndex(clampImageIndex(index, maxImageIndex));
    },
    [maxImageIndex]
  );

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(null);
    setTouchStart(event.targetTouches[0]?.clientX ?? null);
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(event.targetTouches[0]?.clientX ?? null);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStart == null || touchEnd == null || imageCount <= 0) {
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && mobileSlideIndex < maxImageIndex) {
      setMobileSlideIndex(mobileSlideIndex + 1);
    }
    if (isRightSwipe && mobileSlideIndex > 0) {
      setMobileSlideIndex(mobileSlideIndex - 1);
    }
  }, [
    imageCount,
    maxImageIndex,
    minSwipeDistance,
    mobileSlideIndex,
    touchEnd,
    touchStart,
  ]);

  return {
    currentImageIndex,
    setCurrentImageIndex,
    mobileSlideIndex,
    setMobileSlideIndex: handleMobileSlideIndexChange,
    isImageGalleryOpen,
    openGallery,
    closeGallery,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}
