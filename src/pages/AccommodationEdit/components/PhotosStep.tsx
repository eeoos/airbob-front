import React from "react";
import { AccommodationEditImageItem } from "../../../features/accommodations/edit/lib/imageItems";
import { getImageUrl } from "../../../utils/image";
import formStyles from "./EditForm.module.css";
import styles from "./PhotosStep.module.css";

interface PhotosStepProps {
  imageItems: AccommodationEditImageItem[];
  isSaving: boolean;
  uploadProgress: number;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onImageRemove: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOverItem: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export const PhotosStep: React.FC<PhotosStepProps> = ({
  imageItems,
  isSaving,
  uploadProgress,
  draggedIndex,
  dragOverIndex,
  onImageSelect,
  onDrop,
  onDragOver,
  onImageRemove,
  onDragStart,
  onDragOverItem,
  onDragEnd,
}) => (
  <div className={formStyles.stepContent}>
    <h2 className={formStyles.stepTitle}>숙소 사진을 등록하세요</h2>
    <p className={formStyles.stepDescription}>
      숙소 등록을 시작하려면 사진 1장을 제출하셔야 합니다. 나중에 추가하거나 변경하실 수 있습니다.
    </p>

    {isSaving && uploadProgress > 0 && (
      <div className={styles.uploadProgressContainer}>
        <div className={styles.uploadProgressBar}>
          <div
            className={styles.uploadProgressFill}
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className={styles.uploadProgressText}>{uploadProgress}% 업로드 중...</p>
      </div>
    )}

    {imageItems.length === 0 ? (
      <div
        className={styles.imageUploadBox}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <input
          key="empty-image-file-input"
          type="file"
          id="imageInputEmpty"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          multiple
          onChange={onImageSelect}
          className={styles.imageInput}
        />
        <div className={styles.imageUploadBoxLabel}>
          <div className={styles.cameraIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <button
            type="button"
            className={styles.addPhotoButton}
            onClick={() => document.getElementById("imageInputEmpty")?.click()}
          >
            사진 추가하기
          </button>
        </div>
      </div>
    ) : (
      <div className={styles.uploadedImagesSection}>
        <div className={styles.uploadedImagesHeader}>
          <div>
            <p className={styles.uploadedImagesTitle}>
              1개 이상의 사진을 선택하세요.
            </p>
            <p className={styles.uploadedImagesSubtitle}>드래그하여 순서 변경</p>
          </div>
          <button
            type="button"
            className={styles.addMoreButton}
            onClick={() => document.getElementById("imageInput")?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <input
          key="uploaded-image-file-input"
          type="file"
          id="imageInput"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          multiple
          onChange={onImageSelect}
          className={styles.imageInput}
        />

        {imageItems.length > 0 && (() => {
          const coverItem = imageItems[0];
          const coverImageUrl = coverItem.preview || getImageUrl(coverItem.url);
          const coverKey = coverItem.id || coverItem.tempId || `cover-${coverItem.preview || coverItem.url}`;

          return (
            <div className={styles.coverPhotoContainer}>
              <div
                key={coverKey}
                className={`${styles.uploadedImageItem} ${draggedIndex === 0 ? styles.dragging : ""} ${dragOverIndex === 0 ? styles.dragOver : ""}`}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  onDragStart(0);
                }}
                onDragOver={(e) => onDragOverItem(e, 0)}
                onDragEnd={onDragEnd}
              >
                <div className={styles.coverPhotoLabel}>커버 사진</div>
                <img
                  key={`img-${coverKey}`}
                  src={coverImageUrl}
                  alt="커버 사진"
                  className={styles.uploadedImage}
                />
                <button
                  type="button"
                  className={styles.imageMenuButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageRemove(0);
                  }}
                  aria-label="이미지 삭제"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })()}

        <div className={styles.thumbnailGrid}>
          {imageItems.slice(1).map((item, index) => {
            const itemIndex = index + 1;
            const imageUrl = item.preview || getImageUrl(item.url);
            const uniqueKey = item.id || item.tempId || `item-${item.preview || item.url}`;
            return (
              <div
                key={uniqueKey}
                className={`${styles.uploadedImageItem} ${draggedIndex === itemIndex ? styles.dragging : ""} ${dragOverIndex === itemIndex ? styles.dragOver : ""}`}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  onDragStart(itemIndex);
                }}
                onDragOver={(e) => onDragOverItem(e, itemIndex)}
                onDragEnd={onDragEnd}
              >
                <img
                  key={`img-${uniqueKey}`}
                  src={imageUrl}
                  alt={`이미지 ${itemIndex + 1}`}
                  className={styles.uploadedImage}
                />
                <button
                  type="button"
                  className={styles.imageMenuButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageRemove(itemIndex);
                  }}
                  aria-label="이미지 삭제"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}

          <div
            className={styles.addImageSlot}
            onClick={() => document.getElementById("imageInput")?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>추가</span>
          </div>
        </div>
      </div>
    )}
  </div>
);
