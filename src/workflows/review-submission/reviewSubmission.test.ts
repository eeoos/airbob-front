import type { Mocked } from "vitest";
import { waitFor } from "@testing-library/react";
import type { ReviewSubmissionApiPort } from "../../features/reviews/public";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../test/sessionFixtures";
import { AppError } from "../../platform/http/errors";
import { createReviewSubmissionWorkflow } from "./reviewSubmission";

const scope: AuthenticatedSessionScope = {
  subject: "subject:member_7" as SessionSubject,
  epoch: 4,
  runtimeLeaseId: testSessionRuntimeLeaseId,
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
};

const input = (images: readonly File[] = []) => ({
  accommodationId: 31,
  reservationUid: "reservation-31",
  content: "  clean and quiet  ",
  images,
  rating: 5,
});

const createHarness = () => {
  let isRouteCurrent = true;
  let isSessionCurrent = true;
  let capturedScope: AuthenticatedSessionScope | null = scope;
  const api: Mocked<ReviewSubmissionApiPort> = {
    createReview: vi.fn(),
    uploadReviewImages: vi.fn(),
  };
  const publishReviewCreated = vi.fn().mockResolvedValue(undefined);
  const workflow = createReviewSubmissionWorkflow({
    api,
    publication: { publishReviewCreated },
    routeLease: { isCurrent: () => isRouteCurrent },
    session: {
      captureAuthenticatedSession: () => capturedScope,
      isCurrentSession: () => isSessionCurrent,
    },
  });

  return {
    api,
    publishReviewCreated,
    setCapturedScope: (next: AuthenticatedSessionScope | null) => {
      capturedScope = next;
    },
    setRouteCurrent: (next: boolean) => {
      isRouteCurrent = next;
    },
    setSessionCurrent: (next: boolean) => {
      isSessionCurrent = next;
    },
    workflow,
  };
};

describe("review submission workflow", () => {
  it("shares the exact in-flight Promise and suppresses repeats after success", async () => {
    const harness = createHarness();
    const create = deferred<{ reviewId: number }>();
    harness.api.createReview.mockReturnValue(create.promise);

    const first = harness.workflow.submit(input());
    const duplicate = harness.workflow.submit(input());

    expect(duplicate).toBe(first);
    expect(harness.api.createReview).toHaveBeenCalledTimes(1);
    expect(harness.api.createReview).toHaveBeenCalledWith(
      31,
      { content: "clean and quiet", rating: 5 },
      { signal: expect.any(AbortSignal) },
    );

    create.resolve({ reviewId: 901 });
    await expect(first).resolves.toEqual({
      cachePublication: "succeeded",
      reservationUid: "reservation-31",
      reviewId: 901,
      status: "success",
    });
    expect(harness.publishReviewCreated).toHaveBeenCalledWith({
      accommodationId: 31,
      outcome: "success",
      reservationUid: "reservation-31",
      reviewId: 901,
      scope,
    });

    const terminalRepeat = harness.workflow.submit(input());
    expect(terminalRepeat).toBe(first);
    await terminalRepeat;
    expect(harness.api.createReview).toHaveBeenCalledTimes(1);
    expect(harness.publishReviewCreated).toHaveBeenCalledTimes(1);
  });

  it("allows retry only after a definitive create failure and never uploads for that failure", async () => {
    const harness = createHarness();
    const createError = new AppError({
      code: "INVALID_REVIEW",
      kind: "validation",
      message: "create failed",
    });
    harness.api.createReview
      .mockRejectedValueOnce(createError)
      .mockResolvedValueOnce({ reviewId: 902 });

    const failed = harness.workflow.submit(input());
    await expect(failed).resolves.toEqual({
      error: createError,
      status: "definitive-failure",
    });
    expect(harness.api.uploadReviewImages).not.toHaveBeenCalled();
    expect(harness.publishReviewCreated).not.toHaveBeenCalled();

    const retry = harness.workflow.submit(input());
    expect(retry).not.toBe(failed);
    await expect(retry).resolves.toMatchObject({
      reviewId: 902,
      status: "success",
    });
    expect(harness.api.createReview).toHaveBeenCalledTimes(2);
  });

  it("locks an ambiguous create outcome and returns the exact terminal Promise", async () => {
    const harness = createHarness();
    const createError = new AppError({
      code: "NETWORK_ERROR",
      kind: "network",
      message: "connection lost after sending",
      retryable: true,
    });
    harness.api.createReview.mockRejectedValue(createError);

    const first = harness.workflow.submit(input());
    await expect(first).resolves.toEqual({
      error: createError,
      status: "ambiguous",
    });

    const repeat = harness.workflow.submit(input());
    expect(repeat).toBe(first);
    await expect(repeat).resolves.toEqual({
      error: createError,
      status: "ambiguous",
    });
    expect(harness.api.createReview).toHaveBeenCalledTimes(1);
    expect(harness.api.uploadReviewImages).not.toHaveBeenCalled();
    expect(harness.publishReviewCreated).not.toHaveBeenCalled();
  });

  it("treats image upload failure as created-without-images partial success", async () => {
    const image = new File(["image"], "stay.png", { type: "image/png" });
    const harness = createHarness();
    harness.api.createReview.mockResolvedValue({ reviewId: 903 });
    harness.api.uploadReviewImages.mockRejectedValue(
      new Error("upload failed"),
    );

    const result = harness.workflow.submit(input([image]));

    await expect(result).resolves.toEqual({
      cachePublication: "succeeded",
      reason: "upload_failed",
      reservationUid: "reservation-31",
      reviewId: 903,
      status: "created_without_images",
    });
    expect(harness.api.uploadReviewImages).toHaveBeenCalledWith(903, [image], {
      signal: expect.any(AbortSignal),
    });
    expect(harness.publishReviewCreated).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "created_without_images" }),
    );

    expect(harness.workflow.submit(input([image]))).toBe(result);
    expect(harness.api.createReview).toHaveBeenCalledTimes(1);
    expect(harness.api.uploadReviewImages).toHaveBeenCalledTimes(1);
  });

  it("cannot downgrade a created review when cache publication fails", async () => {
    const harness = createHarness();
    harness.api.createReview.mockResolvedValue({ reviewId: 904 });
    harness.publishReviewCreated.mockRejectedValue(new Error("cache failed"));

    await expect(harness.workflow.submit(input())).resolves.toEqual({
      cachePublication: "failed",
      reservationUid: "reservation-31",
      reviewId: 904,
      status: "success",
    });
    expect(harness.workflow.submit(input())).toBe(
      harness.workflow.submit(input()),
    );
    expect(harness.api.createReview).toHaveBeenCalledTimes(1);
  });

  it("does no work without both an active route lease and captured session", async () => {
    const routeStale = createHarness();
    routeStale.setRouteCurrent(false);

    await expect(routeStale.workflow.submit(input())).resolves.toEqual({
      status: "stale",
    });
    expect(routeStale.api.createReview).not.toHaveBeenCalled();

    const noSession = createHarness();
    noSession.setCapturedScope(null);
    await expect(noSession.workflow.submit(input())).resolves.toEqual({
      status: "stale",
    });
    expect(noSession.api.createReview).not.toHaveBeenCalled();
  });

  it("locks the created terminal but suppresses upload and cache after route departure", async () => {
    const image = new File(["image"], "stay.png", { type: "image/png" });
    const harness = createHarness();
    const create = deferred<{ reviewId: number }>();
    harness.api.createReview.mockReturnValue(create.promise);

    const submission = harness.workflow.submit(input([image]));
    harness.setRouteCurrent(false);
    create.resolve({ reviewId: 905 });

    await expect(submission).resolves.toEqual({
      cachePublication: "skipped",
      reservationUid: "reservation-31",
      reviewId: 905,
      status: "created_stale",
    });
    expect(harness.api.uploadReviewImages).not.toHaveBeenCalled();
    expect(harness.publishReviewCreated).not.toHaveBeenCalled();
    expect(harness.workflow.submit(input([image]))).toBe(submission);
  });

  it("suppresses cache continuation when the session changes during upload", async () => {
    const image = new File(["image"], "stay.png", { type: "image/png" });
    const harness = createHarness();
    const upload = deferred<{ uploadedImages: [] }>();
    harness.api.createReview.mockResolvedValue({ reviewId: 906 });
    harness.api.uploadReviewImages.mockReturnValue(upload.promise);

    const submission = harness.workflow.submit(input([image]));
    await Promise.resolve();
    harness.setSessionCurrent(false);
    upload.resolve({ uploadedImages: [] });

    await expect(submission).resolves.toEqual({
      cachePublication: "skipped",
      reservationUid: "reservation-31",
      reviewId: 906,
      status: "created_stale",
    });
    expect(harness.publishReviewCreated).not.toHaveBeenCalled();
  });

  it("returns a non-navigable created terminal when a no-image create becomes stale", async () => {
    const harness = createHarness();
    const create = deferred<{ reviewId: number }>();
    harness.api.createReview.mockReturnValue(create.promise);

    const submission = harness.workflow.submit(input());
    harness.setRouteCurrent(false);
    create.resolve({ reviewId: 907 });

    await expect(submission).resolves.toEqual({
      cachePublication: "skipped",
      reservationUid: "reservation-31",
      reviewId: 907,
      status: "created_stale",
    });
    expect(harness.publishReviewCreated).not.toHaveBeenCalled();
    expect(harness.workflow.submit(input())).toBe(submission);
  });

  it("rechecks the route after publication following a successful upload", async () => {
    const image = new File(["image"], "stay.png", { type: "image/png" });
    const harness = createHarness();
    const publication = deferred<void>();
    harness.api.createReview.mockResolvedValue({ reviewId: 908 });
    harness.api.uploadReviewImages.mockResolvedValue({ uploadedImages: [] });
    harness.publishReviewCreated.mockReturnValue(publication.promise);

    const submission = harness.workflow.submit(input([image]));
    await waitFor(() =>
      expect(harness.publishReviewCreated).toHaveBeenCalledTimes(1),
    );

    harness.setRouteCurrent(false);
    publication.resolve();

    await expect(submission).resolves.toEqual({
      cachePublication: "succeeded",
      reservationUid: "reservation-31",
      reviewId: 908,
      status: "created_stale",
    });
    expect(harness.workflow.submit(input([image]))).toBe(submission);
    expect(harness.api.createReview).toHaveBeenCalledTimes(1);
  });

  it("aborts and fences a pending create when disposed", async () => {
    const harness = createHarness();
    let capturedSignal: AbortSignal | undefined;
    harness.api.createReview.mockImplementation((_id, _input, options) => {
      capturedSignal = options?.signal;
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });

    const submission = harness.workflow.submit(input());
    harness.workflow.dispose();

    expect(capturedSignal?.aborted).toBe(true);
    await expect(submission).resolves.toEqual({ status: "stale" });
    await expect(harness.workflow.submit(input())).resolves.toEqual({
      status: "stale",
    });
    expect(harness.api.createReview).toHaveBeenCalledTimes(1);
    expect(harness.publishReviewCreated).not.toHaveBeenCalled();
  });

  it("aborts a pending upload and preserves the irreversible created terminal", async () => {
    const image = new File(["image"], "stay.png", { type: "image/png" });
    const harness = createHarness();
    let capturedSignal: AbortSignal | undefined;
    harness.api.createReview.mockResolvedValue({ reviewId: 909 });
    harness.api.uploadReviewImages.mockImplementation(
      (_reviewId, _images, options) => {
        capturedSignal = options?.signal;
        return new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      },
    );

    const submission = harness.workflow.submit(input([image]));
    await waitFor(() =>
      expect(harness.api.uploadReviewImages).toHaveBeenCalledTimes(1),
    );
    harness.workflow.dispose();

    expect(capturedSignal?.aborted).toBe(true);
    await expect(submission).resolves.toEqual({
      cachePublication: "skipped",
      reservationUid: "reservation-31",
      reviewId: 909,
      status: "created_stale",
    });
    expect(harness.publishReviewCreated).not.toHaveBeenCalled();
    expect(harness.workflow.submit(input([image]))).toBe(submission);
  });
});
