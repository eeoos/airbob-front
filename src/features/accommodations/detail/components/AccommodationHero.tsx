import React from "react";
import { ImageWithFallback } from "../../../../shared/ui";
import type { AccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import styles from "./AccommodationHero.module.css";

const adaptDivTouchHandler = (
  handler: React.TouchEventHandler<HTMLDivElement> | undefined,
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
  onBack?: () => void;
  onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
  onTouchMove?: React.TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLDivElement>;
}

const PhotoPlaceholderIcon = () => (
  <span aria-hidden="true" className={styles.photoPlaceholderIcon} />
);

const AccommodationHero: React.FC<AccommodationHeroProps> = ({
  detailView,
  mobileSlideIndex,
  onMobileSlideIndexChange,
  onOpenGallery,
  onSave,
  onBack,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) => {
  const handleMobileTouchStart = adaptDivTouchHandler(onTouchStart);
  const handleMobileTouchMove = adaptDivTouchHandler(onTouchMove);
  const handleMobileTouchEnd = adaptDivTouchHandler(onTouchEnd);
  const { heroImages, rating, title } = detailView;
  const primaryHeroImage = heroImages.at(0);

  const handleMobileSliderKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (heroImages.length < 2) return;

    const lastIndex = heroImages.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowLeft"
            ? (mobileSlideIndex + lastIndex) % heroImages.length
            : event.key === "ArrowRight"
              ? (mobileSlideIndex + 1) % heroImages.length
              : null;

    if (nextIndex === null) return;

    event.preventDefault();
    onMobileSlideIndexChange(nextIndex);
  };

  const imageFallback = (label: string) => (
    <span
      className={styles.imageFallback}
      role="img"
      aria-label={`${label} 사진을 불러올 수 없음`}
    >
      <PhotoPlaceholderIcon />
      <span>사진을 준비하고 있어요</span>
    </span>
  );

  return (
    <div className={styles.hero}>
      {onBack && (
        <button
          type="button"
          className={styles.backButton}
          aria-label="이전 화면으로"
          onClick={onBack}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="m12 5-7 7 7 7M5 12h14" />
          </svg>
        </button>
      )}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.titleWrapper}>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.meta}>
              {rating.hasReviews && (
                <div className={styles.review}>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={styles.star}
                  >
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
            <button
              type="button"
              className={styles.saveButton}
              aria-label={
                detailView.isInWishlist ? "저장 목록 열기" : "위시리스트에 저장"
              }
              onClick={onSave}
            >
              <svg
                aria-hidden="true"
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

      <div className={styles.imageSection}>
        {primaryHeroImage ? (
          <>
            <div className={styles.imageGrid}>
              <button
                type="button"
                className={styles.mainImage}
                aria-label={`${title} 대표 사진 크게 보기`}
                onClick={() => onOpenGallery(0)}
              >
                <ImageWithFallback
                  src={primaryHeroImage.url}
                  alt={title}
                  className={styles.image}
                  fallback={imageFallback(`${title} 대표`)}
                />
              </button>
              <div className={styles.thumbnailGrid}>
                {Array.from({ length: 4 }).map((_, index) => {
                  const imageIndex = index + 1;
                  const image = heroImages[imageIndex];

                  if (image) {
                    const isViewAllThumbnail =
                      index === 3 && heroImages.length > 5;

                    return (
                      <button
                        key={image.id}
                        type="button"
                        className={styles.thumbnail}
                        aria-label={
                          isViewAllThumbnail
                            ? `${title} 사진 모두 보기`
                            : `${title} 사진 ${imageIndex + 1} 크게 보기`
                        }
                        onClick={() =>
                          onOpenGallery(isViewAllThumbnail ? 0 : imageIndex)
                        }
                      >
                        <ImageWithFallback
                          src={image.url}
                          alt={image.alt}
                          fallback={imageFallback(image.alt)}
                        />
                        {isViewAllThumbnail && (
                          <div
                            className={styles.viewAllButton}
                            aria-hidden="true"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <path d="M1 1h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zM1 6h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zM1 11h4v4H1zm5 0h4v4H6zm5 0h4v4h-4z" />
                            </svg>
                            <span>사진 모두 보기</span>
                          </div>
                        )}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={`placeholder-${index}`}
                      className={styles.thumbnailPlaceholder}
                      aria-hidden="true"
                    >
                      <PhotoPlaceholderIcon />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.mobileImageSliderFrame}>
              <button
                type="button"
                className={styles.mobileImageSlider}
                aria-keyshortcuts="ArrowLeft ArrowRight Home End"
                aria-label={`${title} 모바일 사진 ${
                  mobileSlideIndex + 1
                } 크게 보기`}
                onTouchStart={handleMobileTouchStart}
                onTouchMove={handleMobileTouchMove}
                onTouchEnd={handleMobileTouchEnd}
                onKeyDown={handleMobileSliderKeyDown}
                onClick={() => onOpenGallery(mobileSlideIndex)}
              >
                <div
                  className={styles.sliderContainer}
                  style={{
                    transform: `translateX(-${mobileSlideIndex * 100}%)`,
                  }}
                >
                  {heroImages.map((image) => (
                    <ImageWithFallback
                      key={image.id}
                      src={image.url}
                      alt={image.alt}
                      className={styles.slideImage}
                      fallback={imageFallback(image.alt)}
                    />
                  ))}
                </div>
                <div className={styles.sliderIndicator}>
                  {mobileSlideIndex + 1} / {heroImages.length}
                </div>
              </button>
              {heroImages.length > 1 && heroImages.length <= 5 && (
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
          </>
        ) : (
          <div
            className={styles.emptyHero}
            role="img"
            aria-label={`${title} 숙소 사진 없음`}
          >
            <PhotoPlaceholderIcon />
            <div>
              <strong>숙소 사진을 준비하고 있어요</strong>
              <span>아래에서 숙소 정보를 계속 확인할 수 있습니다.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccommodationHero;
