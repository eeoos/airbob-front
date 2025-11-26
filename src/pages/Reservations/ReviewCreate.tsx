import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { reviewApi, reservationApi } from "../../api";
import { ReservationDetailInfo } from "../../types/reservation";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import { getImageUrl } from "../../utils/image";
import styles from "./ReviewCreate.module.css";

const ReviewCreate: React.FC = () => {
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { error, handleError, clearError } = useApiError();
  const [reservation, setReservation] = useState<ReservationDetailInfo | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    if (!reservationUid) {
      navigate("/profile");
      return;
    }

    const fetchReservation = async () => {
      setIsLoading(true);
      clearError();

      try {
        const response = await reservationApi.getMyReservationDetail(reservationUid);
        setReservation(response);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservation();
  }, [reservationUid, isAuthenticated, navigate, handleError, clearError]);

  // 컴포넌트 언마운트 시 미리보기 URL 정리
  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => {
        URL.revokeObjectURL(preview);
      });
    };
  }, [imagePreviews]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 파일 크기 검증 (10MB 제한)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        handleError(new Error(`${file.name} 파일 크기는 10MB를 초과할 수 없습니다.`));
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // 이미지 타입 검증
    const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    const filteredFiles = validFiles.filter((file) => {
      if (!imageTypes.includes(file.type)) {
        handleError(new Error(`${file.name}은(는) 지원하지 않는 이미지 형식입니다.`));
        return false;
      }
      return true;
    });

    if (filteredFiles.length === 0) return;

    // 기존 이미지와 합치기
    const newFiles = [...selectedImages, ...filteredFiles];
    setSelectedImages(newFiles);

    // 미리보기 URL 생성
    const newPreviews = filteredFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);

    // input 초기화
    e.target.value = "";
  };

  const handleImageRemove = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);

    // URL 해제
    URL.revokeObjectURL(imagePreviews[index]);

    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation || !comment.trim()) {
      handleError(new Error("리뷰 내용을 입력해주세요."));
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      // 1. 먼저 리뷰 생성
      const createResponse = await reviewApi.create(reservation.accommodation.id, {
        rating,
        content: comment.trim(),
      });

      // 2. 리뷰 생성 성공 시, 이미지가 있으면 업로드
      if (createResponse && selectedImages.length > 0) {
        try {
          await reviewApi.uploadImages(createResponse.id, selectedImages);
        } catch (imageErr) {
          // 이미지 업로드 실패해도 리뷰는 생성되었으므로 경고만 표시
          handleError(new Error("리뷰는 작성되었지만 이미지 업로드에 실패했습니다."));
          // 이미지 업로드 실패해도 리뷰 작성은 완료되었으므로 이동
          navigate(`/reservations/${reservation.reservation_uid}`);
          return;
        }
      }

      // 3. 성공 시 예약 상세 페이지로 이동
      navigate(`/reservations/${reservation.reservation_uid}`);
    } catch (err) {
      handleError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className={styles.loading}>로딩 중...</div>
      </MainLayout>
    );
  }

  if (!reservation) {
    return (
      <MainLayout>
        <div className={styles.error}>예약을 찾을 수 없습니다.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className={styles.container}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>

        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.title}>리뷰 작성</h1>
            <p className={styles.subtitle}>
              {reservation.accommodation.name}에 대한 리뷰를 작성해주세요.
            </p>
          </div>

          <div className={styles.accommodationInfo}>
            {reservation.accommodation.thumbnail_url && (
              <img
                src={getImageUrl(reservation.accommodation.thumbnail_url)}
                alt={reservation.accommodation.name}
                className={styles.accommodationImage}
              />
            )}
            <div className={styles.accommodationDetails}>
              <h2 className={styles.accommodationName}>{reservation.accommodation.name}</h2>
              <p className={styles.accommodationAddress}>
                {[
                  reservation.address.country,
                  reservation.address.state,
                  reservation.address.city,
                  reservation.address.district,
                  reservation.address.street,
                  reservation.address.detail,
                ].filter(Boolean).join(" ")}
              </p>
              <p className={styles.dates}>
                {new Date(reservation.check_in_date_time).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
                -{" "}
                {new Date(reservation.check_out_date_time).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.ratingSection}>
              <label className={styles.label}>평점</label>
              <div className={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`${styles.starButton} ${rating >= star ? styles.filled : ""}`}
                    onClick={() => setRating(star)}
                    aria-label={`${star}점`}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
                <span className={styles.ratingText}>
                  {rating === 5 && "완벽해요!"}
                  {rating === 4 && "좋아요"}
                  {rating === 3 && "괜찮아요"}
                  {rating === 2 && "별로예요"}
                  {rating === 1 && "최악이에요"}
                </span>
              </div>
            </div>

            <div className={styles.commentSection}>
              <label htmlFor="comment" className={styles.label}>
                리뷰 내용
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className={styles.textarea}
                placeholder="숙소에 대한 경험을 공유해주세요..."
                rows={8}
                maxLength={1000}
                required
              />
              <div className={styles.charCount}>{comment.length} / 1000</div>
            </div>

            <div className={styles.imageSection}>
              <label className={styles.label}>사진 추가 (선택사항)</label>
              <div className={styles.imageUploadArea}>
                <input
                  type="file"
                  id="imageInput"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  className={styles.imageInput}
                  disabled={isSubmitting}
                />
                <label
                  htmlFor="imageInput"
                  className={`${styles.imageInputLabel} ${isSubmitting ? styles.disabled : ""}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>사진 선택</span>
                </label>
                <p className={styles.imageHint}>
                  최대 10MB까지 업로드 가능합니다. (JPEG, PNG, GIF, WebP)
                </p>
              </div>

              {imagePreviews.length > 0 && (
                <div className={styles.imagePreviewContainer}>
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className={styles.imagePreviewItem}>
                      <img src={preview} alt={`미리보기 ${index + 1}`} className={styles.imagePreview} />
                      <button
                        type="button"
                        className={styles.imageRemoveButton}
                        onClick={() => handleImageRemove(index)}
                        disabled={isSubmitting}
                        aria-label="이미지 삭제"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSubmitting || !comment.trim()}
              >
                {isSubmitting ? "제출 중..." : "리뷰 작성하기"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}
    </MainLayout>
  );
};

export default ReviewCreate;

