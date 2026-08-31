import { render } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { accommodationReadQueryKeys } from "../../../features/accommodations/detail/queries/queryKeys";
import { createSessionQueryMeta } from "../../../platform/query/sessionScope";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import type { ReviewSubmissionPublicationPort } from "../../../workflows/review-submission";
import { ReviewCreateRoute } from "./ReviewCreateRoute";

let mockCapturedPublication: ReviewSubmissionPublicationPort | null = null;

vi.mock("../../../screens/review-create/public", () => ({
  ReviewCreateController: ({
    publication,
  }: {
    readonly publication: ReviewSubmissionPublicationPort;
  }) => {
    mockCapturedPublication = publication;
    return null;
  },
}));

vi.mock("../../session/useSession", () => ({
  useSession: () => ({
    captureAuthenticatedSession: () => ({
      subject: "subject:member_7",
      epoch: 3,
    }),
    isCurrentSession: () => true,
    state: { status: "authenticated" },
  }),
}));

const scope = {
  subject: "subject:member_7",
  epoch: 3,
} as AuthenticatedSessionScope;

describe("ReviewCreateRoute", () => {
  beforeEach(() => {
    mockCapturedPublication = null;
  });

  it("reports an active accommodation detail refetch failure as a publication failure", async () => {
    const refetchError = new Error("active accommodation refetch failed");
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ id: 42 })
      .mockRejectedValueOnce(refetchError);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const observer = new QueryObserver(queryClient, {
      queryFn,
      queryKey: accommodationReadQueryKeys.detail(scope, 42),
      meta: createSessionQueryMeta(scope),
      retry: false,
    });
    let unsubscribe: () => void = () => undefined;

    try {
      await new Promise<void>((resolve, reject) => {
        unsubscribe = observer.subscribe((result) => {
          if (result.isSuccess) resolve();
          if (result.isError) reject(result.error);
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={["/reservations/reservation-42/review"]}
          >
            <Routes>
              <Route
                path="/reservations/:reservationUid/review"
                element={<ReviewCreateRoute />}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(mockCapturedPublication).not.toBeNull();
      await expect(
        mockCapturedPublication!.publishReviewCreated({
          accommodationId: 42,
          outcome: "success",
          reservationUid: "reservation-42",
          reviewId: 7,
          scope,
        }),
      ).rejects.toBe(refetchError);
      expect(queryFn).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
      queryClient.clear();
    }
  });
});
