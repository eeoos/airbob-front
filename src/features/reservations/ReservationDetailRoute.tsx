import React, { useEffect, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { PaymentStatus } from "../../types/enums";
import { ErrorToast } from "../../components/ErrorToast";
import { routeTo } from "../../routes/paths";
import { getImageUrl } from "../../utils/image";
import { GOOGLE_MAPS_API_KEY } from "../../utils/constants";
import { useReservationDetail } from "./hooks";
import {
  formatReservationStatus,
  getReservationStatusClassKey,
} from "./lib/reservationStatusDisplay";
import {
  canCreateReview,
  formatBankName,
  formatPaymentStatus,
  formatReservationDetailDate,
  formatReservationDetailTime,
} from "./lib/reservationDetailDisplay";
import { formatKoreanDateTime, formatNullablePrice } from "./lib/reservationDateDisplay";
import styles from "./ReservationDetailRoute.module.css";

interface ReservationDetailLocationState {
  toastMessage?: string;
}

interface ReservationDetailRouteProps {
  locationState: unknown;
  navigate: NavigateFunction;
  reservationUid?: string;
}

const getLocationToastMessage = (locationState: unknown) => {
  if (
    locationState &&
    typeof locationState === "object" &&
    typeof (locationState as ReservationDetailLocationState).toastMessage === "string"
  ) {
    return (locationState as ReservationDetailLocationState).toastMessage ?? null;
  }

  return null;
};

export const ReservationDetailRoute: React.FC<ReservationDetailRouteProps> = ({
  locationState,
  navigate,
  reservationUid,
}) => {
  const [routeToastMessage, setRouteToastMessage] = useState<string | null>(() =>
    getLocationToastMessage(locationState),
  );
  const { error, clearError, isLoading, reservation } =
    useReservationDetail(reservationUid);

  useEffect(() => {
    if (!reservationUid) {
      navigate(routeTo.profile(), { replace: true });
    }
  }, [reservationUid, navigate]);

  if (isLoading) {
    return (
      <>
        <div className={styles.loading}>로딩 중...</div>
      </>
    );
  }

  if (!reservation) {
    return (
      <>
        <div className={styles.error}>예약을 찾을 수 없습니다.</div>
      </>
    );
  }

  const canReview = canCreateReview({
    can_write_review: reservation.can_write_review,
    check_out_date_time: reservation.check_out_date_time,
    check_out_time: reservation.check_out_time,
    status: reservation.status,
  });
  const isVirtualAccountPending =
    reservation.payment?.virtual_account &&
    reservation.payment.status === PaymentStatus.WAITING_FOR_DEPOSIT;
  const isPaymentCompleted = reservation.payment?.status === PaymentStatus.DONE;

  return (
    <>
      <div className={styles.container}>
        <button className={styles.backButton} onClick={() => navigate(routeTo.profile())}>
          ← 돌아가기
        </button>

        <div className={styles.content}>
          <div className={styles.mainContent}>
            <section className={styles.section}>
              <button className={styles.backButtonOnImage} onClick={() => navigate(-1)}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
              <div className={styles.accommodationCard}>
                {reservation.accommodation.thumbnail_url && (
                  <img
                    src={getImageUrl(reservation.accommodation.thumbnail_url)}
                    alt={reservation.accommodation.name}
                    className={styles.accommodationImage}
                  />
                )}
                <div className={styles.accommodationInfo}>
                  <p className={styles.accommodationAddress}>
                    {[
                      reservation.address.country,
                      reservation.address.state,
                      reservation.address.city,
                      reservation.address.district,
                      reservation.address.street,
                      reservation.address.detail,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  <div className={styles.hostInfo}>
                    <span className={styles.hostLabel}>호스트:</span>
                    <span className={styles.hostName}>{reservation.host.nickname} 님</span>
                  </div>
                  <div className={styles.dateInfo}>
                    <div className={styles.dateItem}>
                      <span className={styles.dateLabel}>체크인</span>
                      <div className={styles.dateValue}>
                        <span>
                          {formatReservationDetailDate(reservation.check_in_date_time)}
                        </span>
                        <span className={styles.timeValue}>
                          {formatReservationDetailTime(reservation.check_in_time)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.dateItem}>
                      <span className={styles.dateLabel}>체크아웃</span>
                      <div className={styles.dateValue}>
                        <span>
                          {formatReservationDetailDate(reservation.check_out_date_time)}
                        </span>
                        <span className={styles.timeValue}>
                          {formatReservationDetailTime(reservation.check_out_time)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={styles.accommodationBox}
                    onClick={() =>
                      navigate(routeTo.accommodationDetail(reservation.accommodation.id))
                    }
                  >
                    <div className={styles.accommodationBoxContent}>
                      <span>숙소로 이동하기</span>
                      <span className={styles.accommodationBoxArrow}> &gt; </span>
                    </div>
                  </div>
                  {canReview && (
                    <div
                      className={styles.accommodationBox}
                      onClick={() =>
                        navigate(routeTo.reviewCreate(reservation.reservation_uid))
                      }
                    >
                      <div className={styles.accommodationBoxContent}>
                        <span>리뷰 작성하기</span>
                        <span className={styles.accommodationBoxArrow}> &gt; </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionTitleRow}>
                <h2 className={styles.sectionTitle}>예약 세부정보</h2>
                <span
                  className={`${styles.status} ${
                    styles[getReservationStatusClassKey(reservation.status)]
                  }`}
                >
                  {formatReservationStatus(reservation.status)}
                </span>
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>게스트</span>
                  <span className={styles.infoValue}>
                    게스트 {reservation.guest_count}명
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>예약 코드</span>
                  <span className={styles.infoValue}>
                    {reservation.reservation_code}
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.hostSection}>
                <div className={styles.hostAvatar}>
                  {reservation.host.thumbnail_image_url ? (
                    <img
                      src={getImageUrl(reservation.host.thumbnail_image_url)}
                      alt={reservation.host.nickname}
                      className={styles.hostAvatarImage}
                    />
                  ) : (
                    <span className={styles.hostAvatarInitial}>
                      {reservation.host.nickname.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className={styles.hostText}>
                  호스트: {reservation.host.nickname} 님
                </div>
              </div>
            </section>

            {reservation.payment && (
              <section className={styles.section}>
                <div className={styles.sectionTitleRow}>
                  <h2 className={styles.sectionTitle}>결제 정보</h2>
                  <span
                    className={`${styles.paymentStatus} ${
                      isPaymentCompleted
                        ? styles.paid
                        : isVirtualAccountPending
                          ? styles.waiting
                          : styles.pending
                    }`}
                  >
                    {formatPaymentStatus(reservation.payment.status)}
                  </span>
                </div>
                <div className={styles.infoList}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>결제 방법</span>
                    <span className={styles.infoValue}>{reservation.payment.method}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>결제 금액</span>
                    <span className={styles.infoValue}>
                      {formatNullablePrice(reservation.payment.total_amount)}
                    </span>
                  </div>
                  {reservation.payment.approved_at && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>결제 일시</span>
                      <span className={styles.infoValue}>
                        {formatKoreanDateTime(reservation.payment.approved_at)}
                      </span>
                    </div>
                  )}

                  {isVirtualAccountPending && reservation.payment.virtual_account && (
                    <div className={styles.virtualAccountSection}>
                      <h3 className={styles.virtualAccountTitle}>
                        가상계좌 입금 정보
                      </h3>
                      <div className={styles.virtualAccountInfo}>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>은행</span>
                          <span className={styles.virtualAccountValue}>
                            {formatBankName(
                              reservation.payment.virtual_account.bank_code,
                            )}
                          </span>
                        </div>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>계좌번호</span>
                          <span className={styles.virtualAccountValue}>
                            {reservation.payment.virtual_account.account_number}
                          </span>
                        </div>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>예금주</span>
                          <span className={styles.virtualAccountValue}>
                            {reservation.payment.virtual_account.customer_name}
                          </span>
                        </div>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>입금 기한</span>
                          <span className={styles.virtualAccountValue}>
                            {formatKoreanDateTime(
                              reservation.payment.virtual_account.due_date,
                            )}
                          </span>
                        </div>
                      </div>
                      <div className={styles.virtualAccountNotice}>
                        <p>위 가상계좌로 입금 기한 내에 입금해주세요.</p>
                        <p>입금이 확인되면 예약이 확정됩니다.</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <div className={styles.rightSection}>
            <div className={styles.mapContainer}>
              {GOOGLE_MAPS_API_KEY &&
              reservation.coordinate.latitude &&
              reservation.coordinate.longitude ? (
                <iframe
                  className={styles.map}
                  title="숙소 위치"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${reservation.coordinate.latitude},${reservation.coordinate.longitude}&zoom=15`}
                />
              ) : (
                <div className={styles.mapPlaceholder}>지도를 불러올 수 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {(error || routeToastMessage) && (
        <div className={styles.toastContainer}>
          <ErrorToast
            message={error ?? routeToastMessage ?? ""}
            onClose={error ? clearError : () => setRouteToastMessage(null)}
          />
        </div>
      )}
    </>
  );
};
