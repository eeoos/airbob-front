import { Dialog } from "../../../shared/ui";
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
  if (!isOpen || images.length === 0) {
    return null;
  }

  const currentImage = images[currentImageIndex] ?? images[0];
  const normalizedIndex = images.indexOf(currentImage);
  const displayIndex = normalizedIndex >= 0 ? normalizedIndex : 0;

  const showNavigation = images.length > 1;

  const goToPreviousImage = () => {
    onCurrentImageIndexChange(
      displayIndex === 0 ? images.length - 1 : displayIndex - 1
    );
  };

  const goToNextImage = () => {
    onCurrentImageIndexChange(
      displayIndex === images.length - 1 ? 0 : displayIndex + 1
    );
  };

  return (
    <Dialog
      bodyClassName={styles.galleryBody}
      bodyPadding="none"
      className={styles.galleryDialog}
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      size="fullscreen"
      title={`${accommodationName} 사진 갤러리`}
    >
      <button
        type="button"
        aria-label="사진 갤러리 닫기"
        autoFocus
        className={styles.galleryClose}
        onClick={onClose}
      >
        ×
      </button>
      <div className={styles.galleryMain}>
        <img
          src={currentImage.url}
          alt={`${accommodationName} ${displayIndex + 1}`}
          className={styles.galleryImage}
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
            className={`${styles.galleryThumbnail} ${
              index === displayIndex ? styles.galleryThumbnailActive : ""
            }`}
            onClick={() => onCurrentImageIndexChange(index)}
          >
            <img
              src={image.url}
              alt={image.alt}
            />
          </button>
        ))}
      </div>
    </Dialog>
  );
}
