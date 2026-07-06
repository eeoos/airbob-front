import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { reviewApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { ReservationDetailInfo } from "../../../types/reservation";
import { invalidateAccommodationReviewCaches } from "../../accommodations/publicCache";
import { useReservationDetailQuery } from "../../reservations/appShell";
import { invalidateGuestReservationCaches } from "../../reservations/publicCache";

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
  const queryClient = useQueryClient();
  const { error, handleError, clearError } = useApiError();
  const handledErrorUpdatedAtRef = useRef(0);
  const reservationDetailQuery = useReservationDetailQuery(reservationUid);
  const { refetch } = reservationDetailQuery;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reservation =
    reservationDetailQuery.isError ? null : reservationDetailQuery.data ?? null;

  const reload = useCallback(async () => {
    if (!reservationUid) {
      return;
    }

    clearError();
    await refetch();
  }, [clearError, refetch, reservationUid]);

  useEffect(() => {
    if (
      !reservationDetailQuery.isError ||
      !reservationDetailQuery.error ||
      handledErrorUpdatedAtRef.current === reservationDetailQuery.errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current = reservationDetailQuery.errorUpdatedAt;
    handleError(reservationDetailQuery.error);
  }, [
    handleError,
    reservationDetailQuery.error,
    reservationDetailQuery.errorUpdatedAt,
    reservationDetailQuery.isError,
  ]);

  const invalidateReviewCreateCaches = useCallback(
    async (reviewedReservation: ReservationDetailInfo) => {
      await Promise.all([
        invalidateGuestReservationCaches(
          queryClient,
          reviewedReservation.reservation_uid,
        ),
        invalidateAccommodationReviewCaches(
          queryClient,
          reviewedReservation.accommodation.id,
        ),
      ]);
    },
    [queryClient],
  );

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
            await invalidateReviewCreateCaches(reservation);
            handleError(new Error(REVIEW_IMAGE_UPLOAD_ERROR_MESSAGE));
            return {
              status: "upload_failed",
              reservationUid: reservation.reservation_uid,
            };
          }
        }

        await invalidateReviewCreateCaches(reservation);
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
    [clearError, handleError, invalidateReviewCreateCaches, reservation]
  );

  return {
    clearError,
    error,
    handleError,
    isLoading: reservationDetailQuery.isLoading,
    isSubmitting,
    reload,
    reservation,
    submitReview,
  };
}
