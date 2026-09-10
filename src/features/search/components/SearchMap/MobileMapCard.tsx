import { useLayoutEffect, useRef } from "react";
import { calendarLocalDateToDate } from "../../../../shared/lib/calendarLocalDate";
import {
  ImageWithFallback,
  useNonModalOverlayRegistration,
} from "../../../../shared/ui";
import { getSearchAccommodationPriceDisplay } from "../../lib/searchAccommodationViewModel";
import type { SearchMapAccommodation } from "./types";
import styles from "./MobileMapCard.module.css";

interface MobileMapCardProps {
  accommodation: SearchMapAccommodation | null;
  checkIn?: string | null | undefined;
  checkOut?: string | null | undefined;
  getAccommodationHref: (id: number) => string;
  onAccommodationOpen: (id: number) => void;
  onWishlistToggle?: ((id: number) => void) | undefined;
  onClose: () => void;
}

export function MobileMapCard({
  accommodation,
  checkIn,
  checkOut,
  getAccommodationHref,
  onAccommodationOpen,
  onWishlistToggle,
  onClose,
}: MobileMapCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const accommodationId = accommodation?.id;
  useLayoutEffect(() => {
    if (
      accommodationId !== undefined &&
      document.activeElement instanceof HTMLElement &&
      !cardRef.current?.contains(document.activeElement)
    ) {
      triggerRef.current = document.activeElement;
    }
  }, [accommodationId]);
  const close = () => {
    if (cardRef.current?.contains(document.activeElement)) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    onClose();
  };
  const overlay = useNonModalOverlayRegistration({
    enabled: accommodation !== null,
    overlayRef: cardRef,
    triggerRef,
    onClose: close,
  });
  if (!accommodation) return null;

  const price = getSearchAccommodationPriceDisplay(
    accommodation,
    checkIn,
    checkOut,
  );
  const start = checkIn ? calendarLocalDateToDate(checkIn) : null;
  const end = checkOut ? calendarLocalDateToDate(checkOut) : null;
  const dateFormat = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  });

  return (
    <section
      ref={cardRef}
      aria-label="선택한 숙소"
      className={styles.card}
      data-mobile-map-card=""
      onKeyDownCapture={overlay.onKeyDown}
    >
      <a
        className={styles.link}
        href={getAccommodationHref(accommodation.id)}
        aria-label={`숙소 상세 보기: ${accommodation.name}`}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          onAccommodationOpen(accommodation.id);
        }}
      >
        <div className={styles.media}>
          <ImageWithFallback
            src={accommodation.thumbnailUrl}
            alt={accommodation.name}
            className={styles.image}
            fallback={
              <div
                className={styles.placeholder}
                role="img"
                aria-label={`${accommodation.name} 이미지 없음`}
              >
                사진 준비 중
              </div>
            }
          />
        </div>
        <div className={styles.details}>
          <div className={styles.summary}>
            <span className={styles.location}>
              {accommodation.locationLabel}
            </span>
            {accommodation.showReview && (
              <span className={styles.rating}>
                <span aria-hidden="true">★</span>{" "}
                {accommodation.reviewRatingLabel}{" "}
                <span>{accommodation.reviewCountLabel}</span>
              </span>
            )}
          </div>
          <div className={styles.name}>{accommodation.name}</div>
          {start && end && (
            <div className={styles.dates}>
              {dateFormat.format(start)} ~ {dateFormat.format(end)}
            </div>
          )}
          <div className={styles.price}>
            <strong>{price.amountLabel}</strong> <span>{price.unitLabel}</span>
          </div>
        </div>
      </a>
      <div className={styles.actions}>
        {onWishlistToggle && (
          <button
            type="button"
            className={styles.actionButton}
            aria-label={
              accommodation.isInWishlist
                ? "저장 목록 열기"
                : "위시리스트에 저장"
            }
            aria-pressed={accommodation.isInWishlist}
            onClick={() => {
              onWishlistToggle(accommodation.id);
              onClose();
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={accommodation.isInWishlist ? styles.saved : undefined}
              fill={accommodation.isInWishlist ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className={styles.actionButton}
          aria-label="지도 숙소 카드 닫기"
          onClick={close}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </section>
  );
}
