import React, { useState } from "react";
import { ImageWithFallback } from "../../../shared/ui";
import type { AccommodationEditImageItem } from "../editorViewContract";
import formStyles from "./EditForm.module.css";
import styles from "./PhotosStep.module.css";

interface PhotosStepProps {
  imageItems: readonly AccommodationEditImageItem[];
  isSaving: boolean;
  isDeletingImage: boolean;
  uploadProgress: number;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  resolveImageUrl: (imagePath: string | null | undefined) => string;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onImageRemove: (index: number) => void;
  onImageMove: (fromIndex: number, toIndex: number) => void;
  onDragStart: (index: number) => void;
  onDragOverItem: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

interface PhotoOrderControlsProps {
  disabled: boolean;
  index: number;
  label: string;
  total: number;
  onMove: (fromIndex: number, toIndex: number, label: string) => void;
}

const PhotoFallback = ({ label }: { readonly label: string }) => (
  <div
    className={styles.imageFallback}
    role="img"
    aria-label={`${label}을 불러올 수 없음`}
  >
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m5 17 4.5-4.5 3 3 2-2L19 18" />
    </svg>
    <span>사진을 다시 확인해 주세요</span>
  </div>
);

const PhotoOrderControls = ({
  disabled,
  index,
  label,
  total,
  onMove,
}: PhotoOrderControlsProps) => (
  <div
    className={styles.imageMoveControls}
    role="group"
    aria-label={`${label} 순서 변경`}
  >
    <button
      type="button"
      className={styles.imageMoveButton}
      disabled={disabled || index === 0}
      onClick={(event) => {
        event.stopPropagation();
        onMove(index, index - 1, label);
      }}
      aria-label={`${label}을 앞 순서로 이동`}
    >
      <span aria-hidden="true">←</span>
    </button>
    <button
      type="button"
      className={styles.imageMoveButton}
      disabled={disabled || index === total - 1}
      onClick={(event) => {
        event.stopPropagation();
        onMove(index, index + 1, label);
      }}
      aria-label={`${label}을 뒤 순서로 이동`}
    >
      <span aria-hidden="true">→</span>
    </button>
  </div>
);

export const PhotosStep: React.FC<PhotosStepProps> = ({
  imageItems,
  isSaving,
  isDeletingImage,
  uploadProgress,
  draggedIndex,
  dragOverIndex,
  resolveImageUrl,
  onImageSelect,
  onDrop,
  onDragOver,
  onImageRemove,
  onImageMove,
  onDragStart,
  onDragOverItem,
  onDragEnd,
}) => {
  const [orderAnnouncement, setOrderAnnouncement] = useState("");
  const isImageInteractionDisabled = isSaving || isDeletingImage;
  const moveImage = (fromIndex: number, toIndex: number, label: string) => {
    onImageMove(fromIndex, toIndex);
    setOrderAnnouncement(`${label}을 ${toIndex + 1}번째 순서로 이동했습니다.`);
  };

  return (
    <div className={formStyles.stepContent}>
      <h2 className={formStyles.stepTitle}>숙소 사진을 등록하세요</h2>
      <p className={formStyles.stepDescription}>
        숙소 등록을 시작하려면 사진 1장을 제출하셔야 합니다. 나중에 추가하거나
        변경하실 수 있습니다.
      </p>

      {isSaving && uploadProgress > 0 && (
        <div
          className={styles.uploadProgressContainer}
          role="progressbar"
          aria-label="숙소 사진 업로드"
          aria-live="polite"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={uploadProgress}
        >
          <div className={styles.uploadProgressBar} aria-hidden="true">
            <div
              className={styles.uploadProgressFill}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className={styles.uploadProgressText}>
            {uploadProgress}% 업로드 중...
          </p>
        </div>
      )}

      {imageItems.length === 0 ? (
        <div
          className={styles.imageUploadBox}
          onDrop={isImageInteractionDisabled ? undefined : onDrop}
          onDragOver={isImageInteractionDisabled ? undefined : onDragOver}
        >
          <input
            key="empty-image-file-input"
            type="file"
            id="imageInputEmpty"
            aria-label="숙소 사진 선택"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            multiple
            disabled={isImageInteractionDisabled}
            onChange={onImageSelect}
            className={styles.imageInput}
          />
          <div className={styles.imageUploadBoxLabel}>
            <div className={styles.cameraIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <button
              type="button"
              disabled={isImageInteractionDisabled}
              className={styles.addPhotoButton}
              onClick={() =>
                document.getElementById("imageInputEmpty")?.click()
              }
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
              <p className={styles.uploadedImagesSubtitle}>
                드래그하거나 이동 버튼으로 순서를 변경하세요.
              </p>
            </div>
            <button
              type="button"
              disabled={isImageInteractionDisabled}
              className={styles.addMoreButton}
              aria-label="숙소 사진 추가"
              onClick={() => document.getElementById("imageInput")?.click()}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          <input
            key="uploaded-image-file-input"
            type="file"
            id="imageInput"
            aria-label="숙소 사진 추가 선택"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            multiple
            disabled={isImageInteractionDisabled}
            onChange={onImageSelect}
            className={styles.imageInput}
          />

          {imageItems.length > 0 &&
            (() => {
              const [coverItem] = imageItems;
              if (!coverItem) {
                return null;
              }

              const coverImageUrl =
                coverItem.preview || resolveImageUrl(coverItem.url);
              const coverKey = coverItem.id || coverItem.clientId;

              return (
                <div className={styles.coverPhotoContainer}>
                  <div
                    key={coverKey}
                    className={`${styles.uploadedImageItem} ${draggedIndex === 0 ? styles.dragging : ""} ${dragOverIndex === 0 ? styles.dragOver : ""}`}
                    draggable={!isImageInteractionDisabled}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      onDragStart(0);
                    }}
                    onDragOver={(e) => onDragOverItem(e, 0)}
                    onDragEnd={onDragEnd}
                  >
                    <div className={styles.coverPhotoLabel}>커버 사진</div>
                    <ImageWithFallback
                      key={`img-${coverKey}`}
                      src={coverImageUrl}
                      alt="커버 사진"
                      className={styles.uploadedImage}
                      decoding="async"
                      fallback={<PhotoFallback label="커버 사진" />}
                    />
                    <PhotoOrderControls
                      disabled={isImageInteractionDisabled}
                      index={0}
                      label="커버 사진"
                      total={imageItems.length}
                      onMove={moveImage}
                    />
                    <button
                      type="button"
                      disabled={isImageInteractionDisabled}
                      className={styles.imageMenuButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        onImageRemove(0);
                      }}
                      aria-label="이미지 삭제: 커버 사진"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
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
              const imageUrl = item.preview || resolveImageUrl(item.url);
              const uniqueKey = item.id || item.clientId;
              return (
                <div
                  key={uniqueKey}
                  className={`${styles.uploadedImageItem} ${draggedIndex === itemIndex ? styles.dragging : ""} ${dragOverIndex === itemIndex ? styles.dragOver : ""}`}
                  draggable={!isImageInteractionDisabled}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    onDragStart(itemIndex);
                  }}
                  onDragOver={(e) => onDragOverItem(e, itemIndex)}
                  onDragEnd={onDragEnd}
                >
                  <ImageWithFallback
                    key={`img-${uniqueKey}`}
                    src={imageUrl}
                    alt={`이미지 ${itemIndex + 1}`}
                    className={styles.uploadedImage}
                    decoding="async"
                    fallback={
                      <PhotoFallback label={`이미지 ${itemIndex + 1}`} />
                    }
                  />
                  <PhotoOrderControls
                    disabled={isImageInteractionDisabled}
                    index={itemIndex}
                    label={`이미지 ${itemIndex + 1}`}
                    total={imageItems.length}
                    onMove={moveImage}
                  />
                  <button
                    type="button"
                    disabled={isImageInteractionDisabled}
                    className={styles.imageMenuButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      onImageRemove(itemIndex);
                    }}
                    aria-label={`이미지 삭제: ${itemIndex + 1}번째 사진`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              className={styles.addImageSlot}
              aria-label="사진 추가"
              disabled={isImageInteractionDisabled}
              onClick={() => document.getElementById("imageInput")?.click()}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </button>
          </div>
          <p className={styles.orderAnnouncement} aria-live="polite">
            {orderAnnouncement}
          </p>
        </div>
      )}
    </div>
  );
};
