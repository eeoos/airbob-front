import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  useReviewableReservationReadQuery,
  type ReviewableReservation,
} from "../../features/reservations/public";
import {
  createReviewSubmissionWorkflow,
  type ReviewSubmissionPublicationPort,
  type ReviewSubmissionRouteLease,
  type ReviewSubmissionSessionScope,
  type ReviewSubmissionSessionPort,
} from "../../workflows/review-submission";
import { reviewApi } from "../../features/reviews/public";
import { useStrictModeSafeDisposable } from "../../shared/lib/useStrictModeSafeDisposable";
import {
  ReviewCreateScreen,
  type ReviewCreateReservationView,
  type ReviewCreateScreenState,
} from "./ReviewCreateScreen";
import { toReviewCreateErrorMessage } from "./reviewCreateErrorMessage";
import { useReviewImageSelection } from "./useReviewImageSelection";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const REVIEW_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export type ReviewCreateCompletionResult = "success" | "image-upload-failed";

export interface ReviewCreateControllerProps {
  readonly publication: ReviewSubmissionPublicationPort;
  readonly reservationUid: string | null;
  readonly resolveImageUrl: (path: string | null) => string;
  readonly routeLease: ReviewSubmissionRouteLease;
  readonly scope: ReviewSubmissionSessionScope | null;
  readonly session: ReviewSubmissionSessionPort;
  readonly onBack: () => void;
  readonly onComplete: (
    reservationUid: string,
    result: ReviewCreateCompletionResult,
  ) => void;
}

const formatReservationDate = (value: string): string =>
  new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const toReservationView = (
  reservation: ReviewableReservation,
  resolveImageUrl: ReviewCreateControllerProps["resolveImageUrl"],
): ReviewCreateReservationView => ({
  accommodationName: reservation.accommodation.name,
  addressLabel: [
    reservation.address.country,
    reservation.address.state,
    reservation.address.city,
    reservation.address.district,
    reservation.address.street,
    reservation.address.detail,
  ]
    .filter(Boolean)
    .join(" "),
  dateLabel: `${formatReservationDate(
    reservation.checkInDateTime,
  )} - ${formatReservationDate(reservation.checkOutDateTime)}`,
  thumbnailUrl: reservation.accommodation.thumbnailUrl
    ? resolveImageUrl(reservation.accommodation.thumbnailUrl)
    : null,
});

export function ReviewCreateController({
  onBack,
  onComplete,
  publication,
  reservationUid,
  resolveImageUrl,
  routeLease,
  scope,
  session,
}: ReviewCreateControllerProps) {
  const reservationQuery = useReviewableReservationReadQuery({
    reservationUid,
    scope,
  });
  const imageSelection = useReviewImageSelection();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmissionLocked, setIsSubmissionLocked] = useState(false);
  const activeSubmissionRef = useRef<Promise<unknown> | null>(null);
  const didPublishCompletionRef = useRef(false);
  const workflowGeneration = useMemo(
    () => ({
      publication,
      routeLease,
      scopeEpoch: scope?.epoch ?? null,
      scopeSubject: scope?.subject ?? null,
      session,
    }),
    [publication, routeLease, scope?.epoch, scope?.subject, session],
  );
  const workflow = useMemo(
    () =>
      createReviewSubmissionWorkflow({
        api: reviewApi,
        publication: workflowGeneration.publication,
        routeLease: workflowGeneration.routeLease,
        session: workflowGeneration.session,
      }),
    [workflowGeneration],
  );

  useStrictModeSafeDisposable(workflow);

  useLayoutEffect(() => {
    const didInterruptSubmission = activeSubmissionRef.current !== null;
    activeSubmissionRef.current = null;
    didPublishCompletionRef.current = false;
    setIsSubmitting(false);

    if (didInterruptSubmission) {
      setIsSubmissionLocked(true);
      setErrorMessage(
        "리뷰 처리 결과를 확인할 수 없습니다. 예약 상세에서 리뷰 작성 가능 여부를 확인해주세요.",
      );
    }
  }, [workflow]);

  const handleImagesSelected = useCallback(
    (files: readonly File[]) => {
      const validFiles: File[] = [];

      files.forEach((file) => {
        if (file.size > MAX_IMAGE_SIZE) {
          setErrorMessage(
            `${file.name} 파일 크기는 10MB를 초과할 수 없습니다.`,
          );
          return;
        }
        if (!REVIEW_IMAGE_TYPES.has(file.type)) {
          setErrorMessage(
            `${file.name}은(는) 지원하지 않는 이미지 형식입니다.`,
          );
          return;
        }
        validFiles.push(file);
      });

      if (validFiles.length > 0) imageSelection.addFiles(validFiles);
    },
    [imageSelection],
  );

  const handleSubmit = useCallback(async () => {
    if (
      activeSubmissionRef.current ||
      didPublishCompletionRef.current ||
      isSubmissionLocked
    ) {
      return;
    }

    const reservation = reservationQuery.data;
    if (!reservationUid || !reservation || !routeLease.isCurrent()) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    const pending = workflow.submit({
      accommodationId: reservation.accommodation.id,
      reservationUid,
      content: comment,
      images: imageSelection.images.map((image) => image.file),
      rating,
    });
    activeSubmissionRef.current = pending;

    try {
      const result = await pending;
      if (activeSubmissionRef.current !== pending || !routeLease.isCurrent()) {
        return;
      }

      switch (result.status) {
        case "success":
          didPublishCompletionRef.current = true;
          onComplete(result.reservationUid, "success");
          return;
        case "created_without_images":
          didPublishCompletionRef.current = true;
          onComplete(result.reservationUid, "image-upload-failed");
          return;
        case "created_stale":
          return;
        case "definitive-failure":
          setErrorMessage(toReviewCreateErrorMessage(result.error));
          return;
        case "ambiguous":
          setIsSubmissionLocked(true);
          setErrorMessage(
            "리뷰 처리 결과를 확인할 수 없습니다. 예약 상세에서 리뷰 작성 가능 여부를 확인해주세요.",
          );
          return;
        case "invalid":
          setErrorMessage("리뷰 내용을 입력해주세요.");
          return;
        case "stale":
          return;
      }
    } finally {
      if (activeSubmissionRef.current === pending) {
        activeSubmissionRef.current = null;
        if (!didPublishCompletionRef.current) {
          setIsSubmitting(false);
        }
      }
    }
  }, [
    comment,
    imageSelection.images,
    isSubmissionLocked,
    onComplete,
    rating,
    reservationQuery.data,
    reservationUid,
    routeLease,
    workflow,
  ]);

  let state: ReviewCreateScreenState;
  if (!reservationUid) {
    state = { status: "error", message: "예약 정보를 확인할 수 없습니다." };
  } else if (reservationQuery.isLoading) {
    state = { status: "loading" };
  } else if (reservationQuery.isError) {
    state = {
      status: "error",
      message: toReviewCreateErrorMessage(reservationQuery.error),
    };
  } else if (!reservationQuery.data) {
    state = { status: "error", message: "예약을 찾을 수 없습니다." };
  } else if (!reservationQuery.data.canWriteReview) {
    state = {
      status: "error",
      message: "리뷰를 작성할 수 없는 예약입니다.",
    };
  } else {
    state = {
      status: "ready",
      reservation: toReservationView(reservationQuery.data, resolveImageUrl),
    };
  }

  return (
    <ReviewCreateScreen
      comment={comment}
      errorMessage={errorMessage}
      images={imageSelection.images}
      isSubmitting={isSubmitting}
      isSubmitLocked={isSubmissionLocked}
      onBack={onBack}
      onCancel={onBack}
      onClearError={() => setErrorMessage(null)}
      onCommentChange={setComment}
      onImagesSelected={handleImagesSelected}
      onRatingChange={setRating}
      onRemoveImage={imageSelection.removeImage}
      onSubmit={handleSubmit}
      rating={rating}
      state={state}
    />
  );
}
