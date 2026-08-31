import type { ReviewSubmissionApiPort } from "../../features/reviews/public";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";

export type ReviewSubmissionSessionScope = AuthenticatedSessionScope;

export interface ReviewSubmissionInput {
  readonly accommodationId: number;
  readonly reservationUid: string;
  readonly content: string;
  readonly images: readonly File[];
  readonly rating: number;
}

export type ReviewSubmissionCachePublication =
  "succeeded" | "failed" | "skipped";

export interface ReviewSubmissionSuccess {
  readonly status: "success";
  readonly reviewId: number;
  readonly reservationUid: string;
  readonly cachePublication: ReviewSubmissionCachePublication;
}

export interface ReviewSubmissionCreatedWithoutImages {
  readonly status: "created_without_images";
  readonly reason: "upload_failed";
  readonly reviewId: number;
  readonly reservationUid: string;
  readonly cachePublication: ReviewSubmissionCachePublication;
}

export interface ReviewSubmissionCreatedStale {
  readonly status: "created_stale";
  readonly reviewId: number;
  readonly reservationUid: string;
  readonly cachePublication: ReviewSubmissionCachePublication;
}

interface ReviewSubmissionDefinitiveFailure {
  readonly status: "definitive-failure";
  readonly error: unknown;
}

interface ReviewSubmissionAmbiguous {
  readonly status: "ambiguous";
  readonly error: unknown;
}

interface InvalidReviewSubmission {
  readonly status: "invalid";
}

interface StaleReviewSubmission {
  readonly status: "stale";
}

export type CreatedReviewSubmissionResult =
  | ReviewSubmissionSuccess
  | ReviewSubmissionCreatedWithoutImages
  | ReviewSubmissionCreatedStale;

export type ReviewSubmissionResult =
  | CreatedReviewSubmissionResult
  | ReviewSubmissionDefinitiveFailure
  | ReviewSubmissionAmbiguous
  | InvalidReviewSubmission
  | StaleReviewSubmission;

export interface ReviewSubmissionSessionPort {
  captureAuthenticatedSession(): ReviewSubmissionSessionScope | null;
  isCurrentSession(scope: ReviewSubmissionSessionScope): boolean;
}

export interface ReviewSubmissionRouteLease {
  isCurrent(): boolean;
}

type ReviewSubmissionPublicationOutcome = "success" | "created_without_images";

interface ReviewCreatedPublicationInput {
  readonly accommodationId: number;
  readonly outcome: ReviewSubmissionPublicationOutcome;
  readonly reservationUid: string;
  readonly reviewId: number;
  readonly scope: ReviewSubmissionSessionScope;
}

export interface ReviewSubmissionPublicationPort {
  publishReviewCreated(input: ReviewCreatedPublicationInput): Promise<void>;
}

export interface ReviewSubmissionWorkflowDependencies {
  readonly api: ReviewSubmissionApiPort;
  readonly publication: ReviewSubmissionPublicationPort;
  readonly routeLease: ReviewSubmissionRouteLease;
  readonly session: ReviewSubmissionSessionPort;
}

export interface ReviewSubmissionWorkflow {
  submit(input: ReviewSubmissionInput): Promise<ReviewSubmissionResult>;
  dispose(): void;
}
