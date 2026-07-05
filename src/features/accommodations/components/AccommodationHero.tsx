import React from "react";
import type { AccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import styles from "./AccommodationHero.module.css";

const adaptDivTouchHandler = (
  handler: React.TouchEventHandler<HTMLDivElement> | undefined
): React.TouchEventHandler<HTMLButtonElement> | undefined => {
  if (!handler) {
    return undefined;
  }

  return (event) =>
    handler(event as unknown as React.TouchEvent<HTMLDivElement>);
};

interface AccommodationHeroProps {
  detailView: AccommodationDetailViewModel;
  mobileSlideIndex: number;
  onMobileSlideIndexChange: (index: number) => void;
  onOpenGallery: (index: number) => void;
  onSave: () => void;
  onShare: () => void;
  onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
  onTouchMove?: React.TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLDivElement>;
}

const AccommodationHero: React.FC<AccommodationHeroProps> = ({
  detailView,
  mobileSlideIndex,
  onMobileSlideIndexChange,
  onOpenGallery,
  onSave,
  onShare,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) => {
  const handleMobileTouchStart = adaptDivTouchHandler(onTouchStart);
  const handleMobileTouchMove = adaptDivTouchHandler(onTouchMove);
  const handleMobileTouchEnd = adaptDivTouchHandler(onTouchEnd);
  const { heroImages, rating, title } = detailView;

  return (
    <>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.titleWrapper}>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.meta}>
              {rating.hasReviews && (
                <div className={styles.review}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className={styles.star}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span>{rating.averageRatingLabel}</span>
                  <span className={styles.reviewCount}>
                    {rating.reviewCountLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className={styles.actionButtons}>
            <button className={styles.shareButton} onClick={onShare}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span>공유하기</span>
            </button>
            <button className={styles.saveButton} onClick={onSave}>
              <svg
                viewBox="0 0 24 24"
                className={
                  detailView.isInWishlist ? styles.saveIconActive : undefined
                }
                fill={detailView.isInWishlist ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <span>{detailView.isInWishlist ? "저장 목록" : "저장"}</span>
            </button>
          </div>
        </div>
      </div>

      {heroImages.length > 0 && (
        <div className={styles.imageSection}>
          <div className={styles.imageGrid}>
            <button
              type="button"
              className={styles.mainImage}
              aria-label={`${title} 대표 사진 크게 보기`}
              onClick={() => onOpenGallery(0)}
            >
              <img
                src={heroImages[0].url}
                alt={title}
                className={styles.image}
              />
            </button>
            <div className={styles.thumbnailGrid}>
              {Array.from({ length: 4 }).map((_, index) => {
                const imageIndex = index + 1;
                const image = heroImages[imageIndex];

                if (image) {
                  return (
                    <button
                      key={image.id}
                      className={styles.thumbnail}
                      onClick={() => onOpenGallery(imageIndex)}
                    >
                      <img src={image.url} alt={image.alt} />
                      {index === 3 && heroImages.length > 5 && (
                        <div
                          className={styles.viewAllButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenGallery(0);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="1" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="6" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="11" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="1" y="6" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="6" y="6" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="11" y="6" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="1" y="11" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="6" y="11" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="11" y="11" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                          </svg>
                          <span>사진 모두 보기</span>
                        </div>
                      )}
                    </button>
                  );
                }

                return (
                  <div key={`placeholder-${index}`} className={styles.thumbnailPlaceholder}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.mobileImageSliderFrame}>
            <button
              type="button"
              className={styles.mobileImageSlider}
              aria-label={`${title} 사진 ${
                mobileSlideIndex + 1
              } 크게 보기`}
              onTouchStart={handleMobileTouchStart}
              onTouchMove={handleMobileTouchMove}
              onTouchEnd={handleMobileTouchEnd}
              onClick={() => onOpenGallery(mobileSlideIndex)}
            >
              <div
                className={styles.sliderContainer}
                style={{ transform: `translateX(-${mobileSlideIndex * 100}%)` }}
              >
                {heroImages.map((image) => (
                  <img
                    key={image.id}
                    src={image.url}
                    alt={image.alt}
                    className={styles.slideImage}
                  />
                ))}
              </div>
              <div className={styles.sliderIndicator}>
                {mobileSlideIndex + 1} / {heroImages.length}
              </div>
            </button>
            {heroImages.length <= 5 && (
              <div className={styles.sliderDots}>
                {heroImages.map((_, index) => (
                  <button
                    type="button"
                    key={index}
                    aria-label={`${title} 사진 ${index + 1} 보기`}
                    className={`${styles.sliderDot} ${index === mobileSlideIndex ? styles.active : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMobileSlideIndexChange(index);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AccommodationHero;
