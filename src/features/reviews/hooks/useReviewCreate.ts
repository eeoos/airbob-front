import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../../../app/session/useSession";
import { reviewApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { useHandledQueryError } from "../../../query/useHandledQueryError";
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
      status: "failed" | "invalid" | "stale";
    };

const STALE_REVIEW_RESULT: SubmitReviewResult = Object.freeze({
  status: "stale",
});

export function useReviewCreate(reservationUid?: string) {
  const queryClient = useQueryClient();
  const { captureAuthenticatedSession, isCurrentSession } = useSession();
  const { error, handleError, clearError } = useApiError();
  const reservationDetailQuery = useReservationDetailQuery(reservationUid);
  const { refetch } = reservationDetailQuery;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const reservation =
    reservationDetailQuery.isError ? null : reservationDetailQuery.data ?? null;

  const reload = useCallback(async () => {
    if (!reservationUid) {
      return;
    }

    clearError();
    await refetch();
  }, [clearError, refetch, reservationUid]);

  useHandledQueryError({
    error: reservationDetailQuery.error,
    errorUpdatedAt: reservationDetailQuery.errorUpdatedAt,
    isError: reservationDetailQuery.isError,
    onError: handleError,
  });

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
      const capturedSession = captureAuthenticatedSession();
      const normalizedContent = content.trim();
      const isSubmissionCurrent = () =>
        isMountedRef.current &&
        capturedSession !== null &&
        isCurrentSession(capturedSession);

      if (!isSubmissionCurrent()) {
        return STALE_REVIEW_RESULT;
      }

      if (!reservation || !normalizedContent) {
        handleError(new Error("리뷰 내용을 입력해주세요."));
        return { status: "invalid" };
      }

      setIsSubmitting(true);

      try {
        clearError();

        const createResponse = await reviewApi.create(
          reservation.accommodation.id,
          {
            rating,
            content: normalizedContent,
          }
        );
        if (!isSubmissionCurrent()) return STALE_REVIEW_RESULT;

        if (createResponse && images.length > 0) {
          try {
            await reviewApi.uploadImages(createResponse.id, images);
          } catch {
            if (!isSubmissionCurrent()) return STALE_REVIEW_RESULT;

            await invalidateReviewCreateCaches(reservation);
            if (!isSubmissionCurrent()) return STALE_REVIEW_RESULT;

            handleError(new Error(REVIEW_IMAGE_UPLOAD_ERROR_MESSAGE));
            return {
              status: "upload_failed",
              reservationUid: reservation.reservation_uid,
            };
          }

          if (!isSubmissionCurrent()) return STALE_REVIEW_RESULT;
        }

        await invalidateReviewCreateCaches(reservation);
        return isSubmissionCurrent()
          ? {
              status: "success",
              reservationUid: reservation.reservation_uid,
            }
          : STALE_REVIEW_RESULT;
      } catch (err) {
        if (!isSubmissionCurrent()) return STALE_REVIEW_RESULT;

        handleError(err);
        return { status: "failed" };
      } finally {
        if (isSubmissionCurrent()) {
          setIsSubmitting(false);
        }
      }
    },
    [
      captureAuthenticatedSession,
      clearError,
      handleError,
      invalidateReviewCreateCaches,
      isCurrentSession,
      reservation,
    ]
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
