import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
import { PageContainer, StatusBadge } from "../../shared/ui";
import hostStyles from "./HostReservationDetailScreen.module.css";
import { ReservationDetailError } from "./ReservationDetailError";
import type { HostReservationDetailScreenProps } from "./reservationDetailViewContract";

export function HostReservationDetailScreen({
  actions,
  state,
}: HostReservationDetailScreenProps) {
  if (state.status === "loading") {
    return (
      <PageContainer className={hostStyles.loading} variant="content">
        로딩 중...
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer variant="content">
        <ReservationDetailError
          className={requireCssModuleClass(hostStyles.error)}
          message={state.message}
          onDismiss={actions.onDismissError}
          toastClassName={requireCssModuleClass(hostStyles.toastContainer)}
        />
      </PageContainer>
    );
  }

  if (state.status === "missing") {
    return (
      <PageContainer className={hostStyles.error} variant="content">
        예약을 찾을 수 없습니다.
      </PageContainer>
    );
  }

  const { view } = state;

  return (
    <PageContainer className={hostStyles.container} variant="content">
      <button
        aria-label="뒤로 가기"
        className={hostStyles.backButton}
        onClick={actions.onBack}
        type="button"
      >
        ←
      </button>

      <div className={hostStyles.header}>
        <div className={hostStyles.headerLeft}>
          <StatusBadge
            className={requireCssModuleClass(hostStyles.statusBadge)}
            size="sm"
            tone={view.statusTone}
          >
            {view.statusLabel}
          </StatusBadge>
          <div className={hostStyles.guestName}>{view.guest.nickname}</div>
          <div className={hostStyles.guestNights}>
            {view.guestStaySummaryLabel}
          </div>
        </div>
        {view.guest.avatarUrl ? (
          <img
            src={view.guest.avatarUrl}
            alt={view.guest.nickname}
            className={hostStyles.profileImage}
          />
        ) : (
          <div className={hostStyles.profileImagePlaceholder}>
            {view.guest.avatarInitial}
          </div>
        )}
      </div>

      <section
        className={`${hostStyles.section} ${hostStyles.reservationSection}`}
      >
        <h3 className={hostStyles.sectionTitle}>숙소 정보</h3>
        <button
          aria-label="숙소로 이동하기"
          className={hostStyles.accommodationInfo}
          type="button"
          onClick={() => actions.onOpenAccommodation(view.accommodation.id)}
        >
          {view.accommodation.thumbnailUrl ? (
            <img
              src={view.accommodation.thumbnailUrl}
              alt={view.accommodation.name}
              className={hostStyles.accommodationThumbnail}
            />
          ) : (
            <span className={hostStyles.accommodationThumbnailPlaceholder}>
              🏠
            </span>
          )}
          <span className={hostStyles.accommodationDetails}>
            <span className={hostStyles.accommodationInfoName}>
              {view.accommodation.name}
            </span>
            <span className={hostStyles.accommodationInfoAddress}>
              {view.addressLabel}
            </span>
          </span>
          <span className={hostStyles.accommodationArrow}>→</span>
        </button>
      </section>

      <section className={hostStyles.section}>
        <h3 className={hostStyles.sectionTitle}>예약 정보</h3>
        <div className={hostStyles.detailsList}>
          <div className={hostStyles.detailItem}>
            <span className={hostStyles.detailLabel}>게스트</span>
            <span className={hostStyles.detailValue}>
              {view.guestCountLabel}
            </span>
          </div>
          <div className={hostStyles.detailItem}>
            <span className={hostStyles.detailLabel}>체크인</span>
            <span className={hostStyles.detailValue}>
              {view.checkInDateLabel}
            </span>
          </div>
          <div className={hostStyles.detailItem}>
            <span className={hostStyles.detailLabel}>체크아웃</span>
            <span className={hostStyles.detailValue}>
              {view.checkOutDateLabel}
            </span>
          </div>
          <div className={hostStyles.detailItem}>
            <span className={hostStyles.detailLabel}>예약일</span>
            <span className={hostStyles.detailValue}>
              {view.createdAtDateLabel}
            </span>
          </div>
          <div className={hostStyles.detailItem}>
            <span className={hostStyles.detailLabel}>예약 코드</span>
            <span className={hostStyles.detailValue}>
              {view.reservationCode}
            </span>
          </div>
        </div>
      </section>

      {view.payment && (
        <section className={hostStyles.section}>
          <h3 className={hostStyles.sectionTitle}>요금 세부 정보</h3>
          <div className={hostStyles.feeDetails}>
            <div className={hostStyles.feeItem}>
              <span className={hostStyles.feeLabel}>
                {view.payment.nights}박 x {view.payment.pricePerNightLabel}
              </span>
              <span className={hostStyles.feeValue}>
                {view.payment.totalAmountLabel}
              </span>
            </div>
            <div className={hostStyles.feeSeparator} />
            <div className={hostStyles.feeTotal}>
              <span className={hostStyles.feeTotalLabel}>총액 KRW</span>
              <span className={hostStyles.feeTotalValue}>
                {view.payment.totalAmountLabel}
              </span>
            </div>
          </div>
        </section>
      )}
    </PageContainer>
  );
}
