import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getPublicRuntimeConfig } from "../../../platform/config/publicRuntimeConfig";
import { buildGoogleMapsEmbedUrl } from "../../../platform/integrations/googleMaps";
import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import {
  ReservationDetailController,
  type GuestReservationDetailNavigation,
} from "../../../screens/reservation-detail/public";
import { useSession } from "../../session/useSession";
import { reviewSubmissionResultCodec } from "../codecs/reviewSubmissionResultCodec";
import { routeTo } from "../paths";

const REVIEW_IMAGE_UPLOAD_WARNING =
  "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.";

export function ReservationDetailRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const { reservationUid: routeReservationUid } = useParams<{
    reservationUid: string;
  }>();
  const reservationUid = routeReservationUid?.trim() || null;
  const [reviewResult, setReviewResult] = useState(() => {
    const result = reviewSubmissionResultCodec.parse(location.state);

    return result ? { reservationUid, result } : null;
  });
  const reservationUidRef = useRef(reservationUid);
  const scope = session.captureAuthenticatedSession();

  useEffect(() => {
    if (reservationUid === null) navigate(routeTo.profile());
  }, [navigate, reservationUid]);

  useEffect(() => {
    const nextResult = reviewSubmissionResultCodec.parse(location.state);
    const didChangeReservation = reservationUidRef.current !== reservationUid;
    reservationUidRef.current = reservationUid;

    if (!nextResult) {
      if (didChangeReservation) setReviewResult(null);
      return;
    }

    setReviewResult({ reservationUid, result: nextResult });

    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      { replace: true, state: null },
    );
  }, [
    location.hash,
    location.key,
    location.pathname,
    location.search,
    location.state,
    navigate,
    reservationUid,
  ]);

  const navigation = useMemo<GuestReservationDetailNavigation>(
    () => ({
      back: () => navigate(-1),
      backToProfile: () => navigate(routeTo.profile()),
      openAccommodation: (accommodationId) =>
        navigate(routeTo.accommodationDetail(accommodationId)),
      openReview: (nextReservationUid) =>
        navigate(routeTo.reviewCreate(nextReservationUid)),
    }),
    [navigate],
  );

  const buildMapEmbedUrl = useMemo(
    () =>
      (coordinate: { readonly latitude: number; readonly longitude: number }) =>
        buildGoogleMapsEmbedUrl({
          apiKey: getPublicRuntimeConfig().googleMapsBrowserKey ?? "",
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          zoom: 15,
        }),
    [],
  );

  if (
    reservationUid === null ||
    scope === null ||
    !session.isCurrentSession(scope)
  ) {
    return null;
  }

  return (
    <ReservationDetailController
      key={`guest:${reservationUid}:${scope.subject}:${scope.epoch}`}
      variant="guest"
      buildMapEmbedUrl={buildMapEmbedUrl}
      feedbackMessage={
        reviewResult !== null &&
        reviewResult.reservationUid === reservationUid &&
        reviewResult.result === "image-upload-failed"
          ? REVIEW_IMAGE_UPLOAD_WARNING
          : null
      }
      navigation={navigation}
      reservationUid={reservationUid}
      resolveImageUrl={resolveImageUrl}
      scope={scope}
    />
  );
}

export default ReservationDetailRoute;
