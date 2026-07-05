import React, { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { routeTo } from "../../routes/paths";
import { StatusBadge } from "../../shared/ui";
import { useHostReservationDetail } from "./hooks";
import { toHostReservationDetailViewModel } from "./lib/hostReservationDetailViewModel";
import styles from "./HostReservationDetailRoute.module.css";

interface HostReservationDetailRouteProps {
  navigate: NavigateFunction;
  reservationUid?: string;
}

export const HostReservationDetailRoute: React.FC<
  HostReservationDetailRouteProps
> = ({ navigate, reservationUid }) => {
  const { error, clearError, isError, isLoading, reservation } =
    useHostReservationDetail(reservationUid);

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

  const reservationView = toHostReservationDetailViewModel(reservation);

  return (
    <>
      <div className={styles.container}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ←
        </button>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <StatusBadge
              className={styles.statusBadge}
              size="sm"
              tone={reservationView.statusTone}
            >
              {reservationView.statusLabel}
            </StatusBadge>
            <div className={styles.guestName}>
              {reservationView.guest.nickname}
            </div>
            <div className={styles.guestNights}>
              {reservationView.guestStaySummaryLabel}
            </div>
          </div>
          {reservationView.guest.avatarUrl ? (
            <img
              src={reservationView.guest.avatarUrl}
              alt={reservationView.guest.nickname}
              className={styles.profileImage}
            />
          ) : (
            <div className={styles.profileImagePlaceholder}>
              {reservationView.guest.avatarInitial}
            </div>
          )}
        </div>

        {/* Accommodation Info Section */}
        <section className={`${styles.section} ${styles.reservationSection}`}>
          <h3 className={styles.sectionTitle}>숙소 정보</h3>
          <div
            className={styles.accommodationInfo}
            onClick={() =>
              navigate(
                routeTo.accommodationDetail(reservationView.accommodation.id),
              )
            }
          >
            {reservationView.accommodation.thumbnailUrl ? (
              <img
                src={reservationView.accommodation.thumbnailUrl}
                alt={reservationView.accommodation.name}
                className={styles.accommodationThumbnail}
              />
            ) : (
              <div className={styles.accommodationThumbnailPlaceholder}>🏠</div>
            )}
            <div className={styles.accommodationDetails}>
              <div className={styles.accommodationInfoName}>
                {reservationView.accommodation.name}
              </div>
              <div className={styles.accommodationInfoAddress}>
                {reservationView.addressLabel}
              </div>
            </div>
            <div className={styles.accommodationArrow}>→</div>
          </div>
        </section>

        {/* Reservation Details Section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>예약 정보</h3>
          <div className={styles.detailsList}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>게스트</span>
              <span className={styles.detailValue}>
                {reservationView.guestCountLabel}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>체크인</span>
              <span className={styles.detailValue}>
                {reservationView.checkInDateLabel}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>체크아웃</span>
              <span className={styles.detailValue}>
                {reservationView.checkOutDateLabel}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>예약일</span>
              <span className={styles.detailValue}>
                {reservationView.createdAtDateLabel}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>예약 코드</span>
              <span className={styles.detailValue}>
                {reservationView.reservationCode}
              </span>
            </div>
          </div>
        </section>

        {/* Fee Details Section */}
        {reservationView.payment && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>요금 세부 정보</h3>
            <div className={styles.feeDetails}>
              <div className={styles.feeItem}>
                <span className={styles.feeLabel}>
                  {reservationView.payment.nights}박 x{" "}
                  {reservationView.payment.pricePerNightLabel}
                </span>
                <span className={styles.feeValue}>
                  {reservationView.payment.totalAmountLabel}
                </span>
              </div>
              <div className={styles.feeSeparator}></div>
              <div className={styles.feeTotal}>
                <span className={styles.feeTotalLabel}>총액 KRW</span>
                <span className={styles.feeTotalValue}>
                  {reservationView.payment.totalAmountLabel}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>

      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}
    </>
  );
};
