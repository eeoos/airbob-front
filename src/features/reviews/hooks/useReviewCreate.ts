import { useCallback, useEffect, useState } from "react";
import { reservationApi, reviewApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { ReservationDetailInfo } from "../../../types/reservation";

export const REVIEW_IMAGE_UPLOAD_ERROR_MESSAGE =
  "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.";

interface SubmitReviewRequest {
  content: string;
  images: File[];
  rating: number;
}

export type SubmitReviewResult =
  | {
      reservationUid: string;
      status: "success" | "upload_failed";
    }
  | {
      status: "failed" | "invalid";
    };

export function useReviewCreate(reservationUid?: string) {
  const { error, handleError, clearError } = useApiError();
  const [reservation, setReservation] =
    useState<ReservationDetailInfo | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(reservationUid));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reload = useCallback(async () => {
    if (!reservationUid) {
      setReservation(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      const response = await reservationApi.getMyReservationDetail(
        reservationUid
      );
      setReservation(response);
    } catch (err) {
      setReservation(null);
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [clearError, handleError, reservationUid]);

  useEffect(() => {
    reload();
  }, [reload]);

  const submitReview = useCallback(
    async ({
      content,
      images,
      rating,
    }: SubmitReviewRequest): Promise<SubmitReviewResult> => {
      if (!reservation || !content.trim()) {
        handleError(new Error("리뷰 내용을 입력해주세요."));
        return { status: "invalid" };
      }

      setIsSubmitting(true);
      clearError();

      try {
        const createResponse = await reviewApi.create(
          reservation.accommodation.id,
          {
            rating,
            content: content.trim(),
          }
        );

        if (createResponse && images.length > 0) {
          try {
            await reviewApi.uploadImages(createResponse.id, images);
          } catch {
            handleError(new Error(REVIEW_IMAGE_UPLOAD_ERROR_MESSAGE));
            return {
              status: "upload_failed",
              reservationUid: reservation.reservation_uid,
            };
          }
        }

        return {
          status: "success",
          reservationUid: reservation.reservation_uid,
        };
      } catch (err) {
        handleError(err);
        return { status: "failed" };
      } finally {
        setIsSubmitting(false);
      }
    },
    [clearError, handleError, reservation]
  );

  return {
    clearError,
    error,
    handleError,
    isLoading,
    isSubmitting,
    reload,
    reservation,
    submitReview,
  };
}
