import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createAccommodationDetailQueryCacheProjection } from "../../../features/accommodations/detail/public";
import {
  invalidateGuestReservationCaches,
} from "../../../features/reservations/public";
import { createReviewCache } from "../../../features/reviews/public";
import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import {
  ReviewCreateController,
  type ReviewCreateCompletionResult,
} from "../../../screens/review-create/public";
import type { ReviewSubmissionPublicationPort } from "../../../workflows/review-submission";
import { useSession } from "../../session/useSession";
import { createReviewSubmissionResultState } from "../codecs/reviewSubmissionResultCodec";
import { routeTo } from "../paths";

export function ReviewCreateRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const { reservationUid: routeReservationUid } = useParams<{
    reservationUid: string;
  }>();
  const reservationUid = routeReservationUid?.trim() || null;
  const captureAuthenticatedSession = session.captureAuthenticatedSession;
  const isCurrentSession = session.isCurrentSession;
  const workflowSession = useMemo(
    () => ({ captureAuthenticatedSession, isCurrentSession }),
    [captureAuthenticatedSession, isCurrentSession],
  );
  const authenticatedScope = captureAuthenticatedSession();

  const routeLease = useMemo(
    () => ({
      isCurrent: () =>
        browserWindowNavigation.isCurrentHistoryEntry({
          hash: location.hash,
          key: location.key,
          pathname: location.pathname,
          search: location.search,
        }),
    }),
    [location.hash, location.key, location.pathname, location.search],
  );

  const publication = useMemo<ReviewSubmissionPublicationPort>(() => {
    const reviewCache = createReviewCache(queryClient);
    const accommodationCache =
      createAccommodationDetailQueryCacheProjection(queryClient);

    return {
      async publishReviewCreated(input) {
        accommodationCache.detailRefreshRequired({
          accommodationId: input.accommodationId,
          scope: input.scope,
        });
        await Promise.all([
          reviewCache.reviewCreated(input),
          invalidateGuestReservationCaches(
            queryClient,
            input.reservationUid,
          ),
        ]);
      },
    };
  }, [queryClient]);

  const handleComplete = (
    completedReservationUid: string,
    result: ReviewCreateCompletionResult,
  ) => {
    if (!routeLease.isCurrent()) return;

    navigate(routeTo.reservationDetail(completedReservationUid), {
      replace: true,
      state:
        result === "image-upload-failed"
          ? createReviewSubmissionResultState("image-upload-failed")
          : null,
    });
  };

  return (
    <ReviewCreateController
      key={reservationUid ?? "invalid"}
      onBack={() => navigate(-1)}
      onComplete={handleComplete}
      publication={publication}
      reservationUid={reservationUid}
      resolveImageUrl={resolveImageUrl}
      routeLease={routeLease}
      scope={authenticatedScope}
      session={workflowSession}
    />
  );
}

export default ReviewCreateRoute;
