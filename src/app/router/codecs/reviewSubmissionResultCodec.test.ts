import {
  createReviewSubmissionResultState,
  reviewSubmissionResultCodec,
} from "./reviewSubmissionResultCodec";

describe("reviewSubmissionResultCodec", () => {
  it("round-trips the exact versioned partial-success code", () => {
    const state = createReviewSubmissionResultState("image-upload-failed");

    expect(reviewSubmissionResultCodec.parse(state)).toBe(
      "image-upload-failed",
    );
  });

  it.each([
    null,
    {},
    { toastMessage: "injected copy" },
    { reviewSubmission: { version: 2, result: "image-upload-failed" } },
    { reviewSubmission: { version: 1, result: "unknown" } },
    {
      reviewSubmission: {
        version: 1,
        result: "image-upload-failed",
        extra: true,
      },
    },
  ])("rejects unknown or free-form history state %#", (state) => {
    expect(reviewSubmissionResultCodec.parse(state)).toBeNull();
  });
});
