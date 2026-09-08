import { useRef } from "react";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import { Dialog, ImageWithFallback } from "../../../../shared/ui";
import type { AccommodationDetailImageViewModel } from "../lib/accommodationDetailViewModel";
import styles from "./AccommodationImageGalleryModal.module.css";

interface AccommodationImageGalleryModalProps {
  isOpen: boolean;
  accommodationName: string;
  images: AccommodationDetailImageViewModel[];
  currentImageIndex: number;
  onCurrentImageIndexChange: (index: number) => void;
  onClose: () => void;
}

export function AccommodationImageGalleryModal({
  isOpen,
  accommodationName,
  images,
  currentImageIndex,
  onCurrentImageIndexChange,
  onClose,
}: AccommodationImageGalleryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const defaultImage = images.at(0);

  if (!isOpen || !defaultImage) {
    return null;
  }

  const currentImage = images.at(currentImageIndex) ?? defaultImage;
  const normalizedIndex = images.indexOf(currentImage);
  const displayIndex = normalizedIndex >= 0 ? normalizedIndex : 0;

  const showNavigation = images.length > 1;
  const imageFallback = (label: string) => (
    <div
      className={styles.galleryImageFallback}
      role="img"
      aria-label={`${label} 사진을 불러올 수 없음`}
    >
      <span aria-hidden="true">⌂</span>
      <strong>사진을 불러올 수 없어요</strong>
    </div>
  );

  const goToPreviousImage = () => {
    onCurrentImageIndexChange(
      displayIndex === 0 ? images.length - 1 : displayIndex - 1,
    );
  };

  const goToNextImage = () => {
    onCurrentImageIndexChange(
      displayIndex === images.length - 1 ? 0 : displayIndex + 1,
    );
  };

  return (
    <Dialog
      bodyClassName={requireCssModuleClass(styles.galleryBody)}
      bodyPadding="none"
      className={requireCssModuleClass(styles.galleryDialog)}
      initialFocusRef={closeButtonRef}
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      size="fullscreen"
      title={`${accommodationName} 사진 갤러리`}
    >
      <button
        ref={closeButtonRef}
        type="button"
        aria-label="사진 갤러리 닫기"
        className={styles.galleryClose}
        onClick={onClose}
      >
        ×
      </button>
      <div className={styles.galleryMain}>
        <ImageWithFallback
          src={currentImage.url}
          alt={`${accommodationName} ${displayIndex + 1}`}
          className={styles.galleryImage}
          fallback={imageFallback(`${accommodationName} ${displayIndex + 1}`)}
        />
        {showNavigation && (
          <>
            <button
              type="button"
              aria-label="이전 사진"
              className={`${styles.galleryNav} ${styles.galleryPrev}`}
              onClick={goToPreviousImage}
              disabled={!showNavigation}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="다음 사진"
              className={`${styles.galleryNav} ${styles.galleryNext}`}
              onClick={goToNextImage}
              disabled={!showNavigation}
            >
              ›
            </button>
          </>
        )}
      </div>
      <div className={styles.galleryThumbnails}>
        {images.map((image, index) => (
          <button
            type="button"
            key={image.id}
            aria-label={`${accommodationName} 사진 ${index + 1} 보기`}
            className={`${styles.galleryThumbnail} ${
              index === displayIndex ? styles.galleryThumbnailActive : ""
            }`}
            onClick={() => onCurrentImageIndexChange(index)}
          >
            <ImageWithFallback
              src={image.url}
              alt={image.alt}
              fallback={imageFallback(image.alt)}
            />
          </button>
        ))}
      </div>
    </Dialog>
  );
}
