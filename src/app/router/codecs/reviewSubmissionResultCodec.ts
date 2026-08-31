export type ReviewSubmissionResultCode = "image-upload-failed";

export interface ReviewSubmissionResultState {
  readonly reviewSubmission: {
    readonly version: 1;
    readonly result: ReviewSubmissionResultCode;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const createReviewSubmissionResultState = (
  result: ReviewSubmissionResultCode,
): ReviewSubmissionResultState => ({
  reviewSubmission: {
    version: 1,
    result,
  },
});

const parseReviewSubmissionResult = (
  value: unknown,
): ReviewSubmissionResultCode | null => {
  if (!isRecord(value) || Object.keys(value).length !== 1) {
    return null;
  }

  const submission = value.reviewSubmission;
  if (!isRecord(submission) || Object.keys(submission).length !== 2) {
    return null;
  }

  return submission.version === 1 && submission.result === "image-upload-failed"
    ? submission.result
    : null;
};

export const reviewSubmissionResultCodec = {
  parse: parseReviewSubmissionResult,
  serialize: createReviewSubmissionResultState,
} as const;
