import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ReservationDetailRoute as LegacyReservationDetailRoute,
} from "../../../features/reservations/ReservationDetailRoute";
import { reviewSubmissionResultCodec } from "../codecs/reviewSubmissionResultCodec";

const REVIEW_IMAGE_UPLOAD_WARNING =
  "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.";

export function ReservationDetailRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [reviewResult, setReviewResult] = useState(() => {
    const result = reviewSubmissionResultCodec.parse(location.state);

    return result ? { reservationUid, result } : null;
  });
  const reservationUidRef = useRef(reservationUid);

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

  return (
    <LegacyReservationDetailRoute
      key={reservationUid ?? "invalid"}
      locationState={
        reviewResult !== null &&
        reviewResult.reservationUid === reservationUid &&
        reviewResult.result === "image-upload-failed"
          ? { toastMessage: REVIEW_IMAGE_UPLOAD_WARNING }
          : null
      }
      navigate={navigate}
      reservationUid={reservationUid}
    />
  );
}

export default ReservationDetailRoute;
