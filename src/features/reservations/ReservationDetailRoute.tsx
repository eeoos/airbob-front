import React, { useEffect, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { routeTo } from "../../routes/paths";
import { StatusBadge } from "../../shared/ui";
import { GOOGLE_MAPS_API_KEY } from "../../utils/constants";
import { useReservationDetail } from "./hooks";
import { toReservationDetailViewModel } from "./lib/reservationDetailViewModel";
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
  const { error, clearError, isError, isLoading, reservation } =
    useReservationDetail(reservationUid);

  useEffect(() => {
    if (!reservationUid) {
      navigate(routeTo.profile());
    }
  }, [reservationUid, navigate]);

  if (isLoading) {
    return (
      <>
        <div className={styles.loading}>로딩 중...</div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <div className={styles.error}>예약 정보를 불러오지 못했습니다.</div>
        {error && (
          <div className={styles.toastContainer}>
            <ErrorToast message={error} onClose={clearError} />
          </div>
        )}
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

  const reservationView = toReservationDetailViewModel(reservation);

  return (
    <>
      <div className={styles.container}>
        <button
          className={styles.backButton}
          type="button"
          onClick={() => navigate(routeTo.profile())}
        >
          ← 돌아가기
        </button>

        <div className={styles.content}>
          <div className={styles.mainContent}>
            <section className={styles.section}>
              <button
                aria-label="뒤로 가기"
                className={styles.backButtonOnImage}
                type="button"
                onClick={() => navigate(-1)}
              >
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
                {reservationView.accommodation.thumbnailUrl && (
                  <img
                    src={reservationView.accommodation.thumbnailUrl}
                    alt={reservationView.accommodation.name}
                    className={styles.accommodationImage}
                  />
                )}
                <div className={styles.accommodationInfo}>
                  <p className={styles.accommodationAddress}>
                    {reservationView.addressLabel}
                  </p>
                  <div className={styles.hostInfo}>
                    <span className={styles.hostLabel}>호스트:</span>
                    <span className={styles.hostName}>
                      {reservationView.host.displayName}
                    </span>
                  </div>
                  <div className={styles.dateInfo}>
                    <div className={styles.dateItem}>
                      <span className={styles.dateLabel}>체크인</span>
                      <div className={styles.dateValue}>
                        <span>{reservationView.checkIn.dateLabel}</span>
                        <span className={styles.timeValue}>
                          {reservationView.checkIn.timeLabel}
                        </span>
                      </div>
                    </div>
                    <div className={styles.dateItem}>
                      <span className={styles.dateLabel}>체크아웃</span>
                      <div className={styles.dateValue}>
                        <span>{reservationView.checkOut.dateLabel}</span>
                        <span className={styles.timeValue}>
                          {reservationView.checkOut.timeLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={styles.accommodationBox}
                    onClick={() =>
                      navigate(
                        routeTo.accommodationDetail(
                          reservationView.accommodation.id,
                        ),
                      )
                    }
                  >
                    <div className={styles.accommodationBoxContent}>
                      <span>숙소로 이동하기</span>
                      <span className={styles.accommodationBoxArrow}> &gt; </span>
                    </div>
                  </div>
                  {reservationView.canReview && (
                    <div
                      className={styles.accommodationBox}
                      onClick={() =>
                        navigate(routeTo.reviewCreate(reservationView.reservationUid))
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
                <StatusBadge tone={reservationView.status.tone}>
                  {reservationView.status.label}
                </StatusBadge>
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>게스트</span>
                  <span className={styles.infoValue}>
                    {reservationView.guestCountLabel}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>예약 코드</span>
                  <span className={styles.infoValue}>
                    {reservationView.reservationCode}
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.hostSection}>
                <div className={styles.hostAvatar}>
                  {reservationView.host.avatarUrl ? (
                    <img
                      src={reservationView.host.avatarUrl}
                      alt={reservationView.host.nickname}
                      className={styles.hostAvatarImage}
                    />
                  ) : (
                    <span className={styles.hostAvatarInitial}>
                      {reservationView.host.avatarInitial}
                    </span>
                  )}
                </div>
                <div className={styles.hostText}>
                  호스트: {reservationView.host.displayName}
                </div>
              </div>
            </section>

            {reservationView.payment && (
              <section className={styles.section}>
                <div className={styles.sectionTitleRow}>
                  <h2 className={styles.sectionTitle}>결제 정보</h2>
                  <StatusBadge tone={reservationView.payment.statusTone}>
                    {reservationView.payment.statusLabel}
                  </StatusBadge>
                </div>
                <div className={styles.infoList}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>결제 방법</span>
                    <span className={styles.infoValue}>
                      {reservationView.payment.methodLabel}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>결제 금액</span>
                    <span className={styles.infoValue}>
                      {reservationView.payment.amountLabel}
                    </span>
                  </div>
                  {reservationView.payment.approvedAtLabel && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>결제 일시</span>
                      <span className={styles.infoValue}>
                        {reservationView.payment.approvedAtLabel}
                      </span>
                    </div>
                  )}

                  {reservationView.payment.virtualAccount && (
                    <div className={styles.virtualAccountSection}>
                      <h3 className={styles.virtualAccountTitle}>
                        가상계좌 입금 정보
                      </h3>
                      <div className={styles.virtualAccountInfo}>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>은행</span>
                          <span className={styles.virtualAccountValue}>
                            {reservationView.payment.virtualAccount.bankName}
                          </span>
                        </div>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>계좌번호</span>
                          <span className={styles.virtualAccountValue}>
                            {reservationView.payment.virtualAccount.accountNumber}
                          </span>
                        </div>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>예금주</span>
                          <span className={styles.virtualAccountValue}>
                            {reservationView.payment.virtualAccount.customerName}
                          </span>
                        </div>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>입금 기한</span>
                          <span className={styles.virtualAccountValue}>
                            {reservationView.payment.virtualAccount.dueDateLabel}
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
              reservationView.mapCoordinate ? (
                <iframe
                  className={styles.map}
                  title="숙소 위치"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${reservationView.mapCoordinate.latitude},${reservationView.mapCoordinate.longitude}&zoom=15`}
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
