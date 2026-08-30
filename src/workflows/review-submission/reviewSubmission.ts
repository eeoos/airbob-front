import { isAppError } from "../../platform/http/errors";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import type {
  CreatedReviewSubmissionResult,
  ReviewSubmissionCachePublication,
  ReviewSubmissionCreatedWithoutImages,
  ReviewSubmissionCreatedStale,
  ReviewSubmissionInput,
  ReviewSubmissionResult,
  ReviewSubmissionSuccess,
  ReviewSubmissionWorkflow,
  ReviewSubmissionWorkflowDependencies,
} from "./types";

const STALE_RESULT = Object.freeze({ status: "stale" as const });
const INVALID_RESULT = Object.freeze({ status: "invalid" as const });

const isTerminalResult = (
  result: ReviewSubmissionResult,
): result is CreatedReviewSubmissionResult | Extract<
  ReviewSubmissionResult,
  { readonly status: "ambiguous" }
> =>
  result.status === "success" ||
  result.status === "created_without_images" ||
  result.status === "created_stale" ||
  result.status === "ambiguous";

const isDefinitiveFailure = (error: unknown): boolean => {
  if (!isAppError(error)) return false;

  switch (error.kind) {
    case "authentication":
    case "validation":
    case "conflict":
      return true;
    case "http":
      return !error.retryable;
    default:
      return false;
  }
};

const isValidInput = (input: ReviewSubmissionInput): boolean =>
  Number.isSafeInteger(input.accommodationId) &&
  input.accommodationId > 0 &&
  Number.isInteger(input.rating) &&
  input.rating >= 1 &&
  input.rating <= 5 &&
  input.reservationUid.trim().length > 0 &&
  input.content.trim().length > 0;

const toCreatedWithoutImages = (
  input: ReviewSubmissionInput,
  reviewId: number,
  cachePublication: ReviewSubmissionCachePublication = "skipped",
): ReviewSubmissionCreatedWithoutImages => ({
  cachePublication,
  reason: "upload_failed",
  reservationUid: input.reservationUid,
  reviewId,
  status: "created_without_images",
});

const toCreatedStale = (
  input: ReviewSubmissionInput,
  reviewId: number,
  cachePublication: ReviewSubmissionCachePublication = "skipped",
): ReviewSubmissionCreatedStale => ({
  cachePublication,
  reservationUid: input.reservationUid,
  reviewId,
  status: "created_stale",
});

export const createReviewSubmissionWorkflow = ({
  api,
  publication,
  routeLease,
  session,
}: ReviewSubmissionWorkflowDependencies): ReviewSubmissionWorkflow => {
  let disposed = false;
  let activeController: AbortController | null = null;
  let activePromise: Promise<ReviewSubmissionResult> | null = null;
  let terminalPromise: Promise<ReviewSubmissionResult> | null = null;

  const isContinuationCurrent = (scope: AuthenticatedSessionScope): boolean =>
    !disposed &&
    routeLease.isCurrent() &&
    session.isCurrentSession(scope);

  const publishCreatedReview = async (
    input: ReviewSubmissionInput,
    scope: AuthenticatedSessionScope,
    result: ReviewSubmissionSuccess | ReviewSubmissionCreatedWithoutImages,
  ): Promise<CreatedReviewSubmissionResult> => {
    if (!isContinuationCurrent(scope)) {
      return toCreatedStale(input, result.reviewId);
    }

    let cachePublication: ReviewSubmissionCachePublication;
    try {
      await publication.publishReviewCreated({
        accommodationId: input.accommodationId,
        outcome: result.status,
        reservationUid: input.reservationUid,
        reviewId: result.reviewId,
        scope,
      });
      cachePublication = "succeeded";
    } catch {
      cachePublication = "failed";
    }

    return isContinuationCurrent(scope)
      ? { ...result, cachePublication }
      : toCreatedStale(input, result.reviewId, cachePublication);
  };

  const runSubmission = async (
    input: ReviewSubmissionInput,
    scope: AuthenticatedSessionScope,
    controller: AbortController,
  ): Promise<ReviewSubmissionResult> => {
    let reviewId: number;

    try {
      const created = await api.createReview(
        input.accommodationId,
        { content: input.content, rating: input.rating },
        { signal: controller.signal },
      );
      reviewId = created.reviewId;
    } catch (error) {
      if (!isContinuationCurrent(scope)) return STALE_RESULT;

      return isDefinitiveFailure(error)
        ? { error, status: "definitive-failure" }
        : { error, status: "ambiguous" };
    }

    if (input.images.length === 0) {
      return publishCreatedReview(input, scope, {
        cachePublication: "skipped",
        reservationUid: input.reservationUid,
        reviewId,
        status: "success",
      });
    }

    if (!isContinuationCurrent(scope)) {
      return toCreatedStale(input, reviewId);
    }

    try {
      await api.uploadReviewImages(reviewId, input.images, {
        signal: controller.signal,
      });
    } catch {
      if (!isContinuationCurrent(scope)) {
        return toCreatedStale(input, reviewId);
      }

      return publishCreatedReview(
        input,
        scope,
        toCreatedWithoutImages(input, reviewId),
      );
    }

    if (!isContinuationCurrent(scope)) {
      return toCreatedStale(input, reviewId);
    }

    return publishCreatedReview(input, scope, {
      cachePublication: "skipped",
      reservationUid: input.reservationUid,
      reviewId,
      status: "success",
    });
  };

  return {
    submit(rawInput) {
      if (terminalPromise) return terminalPromise;
      if (activePromise) return activePromise;

      const scope = session.captureAuthenticatedSession();
      if (
        scope === null ||
        disposed ||
        !routeLease.isCurrent() ||
        !session.isCurrentSession(scope)
      ) {
        return Promise.resolve(STALE_RESULT);
      }

      if (!isValidInput(rawInput)) {
        return Promise.resolve(INVALID_RESULT);
      }

      const input: ReviewSubmissionInput = {
        ...rawInput,
        content: rawInput.content.trim(),
        images: [...rawInput.images],
        reservationUid: rawInput.reservationUid.trim(),
      };
      const controller = new AbortController();
      const promise = runSubmission(input, scope, controller);
      activeController = controller;
      activePromise = promise;

      void promise.then((result) => {
        if (isTerminalResult(result)) {
          terminalPromise = promise;
        }

        if (activePromise === promise) {
          activePromise = null;
        }
        if (activeController === controller) {
          activeController = null;
        }
      });

      return promise;
    },

    dispose() {
      if (disposed) return;

      disposed = true;
      activeController?.abort();
      activeController = null;
    },
  };
};
