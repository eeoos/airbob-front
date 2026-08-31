import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
import { StatusBadge, ToastHost, type StatusBadgeTone } from "../../shared/ui";
import guestStyles from "./GuestReservationDetailScreen.module.css";
import hostStyles from "./HostReservationDetailScreen.module.css";

type ReservationDetailStatusTone = StatusBadgeTone;

export type ReservationDetailState<TView> =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string | null }
  | { readonly status: "missing" }
  | { readonly status: "ready"; readonly view: TView };

export interface GuestReservationDetailView {
  readonly reservationUid: string;
  readonly reservationCode: string;
  readonly guestCountLabel: string;
  readonly accommodation: {
    readonly id: number;
    readonly name: string;
    readonly thumbnailUrl: string | null;
  };
  readonly addressLabel: string;
  readonly checkIn: {
    readonly dateLabel: string;
    readonly timeLabel: string;
  };
  readonly checkOut: {
    readonly dateLabel: string;
    readonly timeLabel: string;
  };
  readonly host: {
    readonly nickname: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly avatarInitial: string;
  };
  readonly status: {
    readonly label: string;
    readonly tone: ReservationDetailStatusTone;
  };
  readonly canReview: boolean;
  readonly payment: {
    readonly methodLabel: string;
    readonly amountLabel: string;
    readonly approvedAtLabel: string | null;
    readonly statusLabel: string;
    readonly statusTone: ReservationDetailStatusTone;
    readonly virtualAccount: {
      readonly bankName: string;
      readonly accountNumber: string;
      readonly customerName: string;
      readonly dueDateLabel: string;
    } | null;
  } | null;
  readonly mapEmbedUrl: string | null;
}

export interface HostReservationDetailView {
  readonly reservationCode: string;
  readonly statusLabel: string;
  readonly statusTone: ReservationDetailStatusTone;
  readonly guest: {
    readonly nickname: string;
    readonly avatarUrl: string | null;
    readonly avatarInitial: string;
  };
  readonly guestStaySummaryLabel: string;
  readonly accommodation: {
    readonly id: number;
    readonly name: string;
    readonly thumbnailUrl: string | null;
  };
  readonly addressLabel: string;
  readonly guestCountLabel: string;
  readonly checkInDateLabel: string;
  readonly checkOutDateLabel: string;
  readonly createdAtDateLabel: string;
  readonly payment: {
    readonly nights: number;
    readonly pricePerNightLabel: string;
    readonly totalAmountLabel: string;
  } | null;
}

export interface GuestReservationDetailActions {
  readonly onBack: () => void;
  readonly onBackToProfile: () => void;
  readonly onDismissError: () => void;
  readonly onDismissFeedback: () => void;
  readonly onOpenAccommodation: (accommodationId: number) => void;
  readonly onOpenReview: (reservationUid: string) => void;
}

export interface HostReservationDetailActions {
  readonly onBack: () => void;
  readonly onDismissError: () => void;
  readonly onOpenAccommodation: (accommodationId: number) => void;
}

export type ReservationDetailScreenProps =
  | {
      readonly variant: "guest";
      readonly state: ReservationDetailState<GuestReservationDetailView>;
      readonly feedbackMessage: string | null;
      readonly actions: GuestReservationDetailActions;
    }
  | {
      readonly variant: "host";
      readonly state: ReservationDetailState<HostReservationDetailView>;
      readonly actions: HostReservationDetailActions;
    };

interface ErrorDetailProps {
  readonly className: string;
  readonly message: string | null;
  readonly onDismiss: () => void;
  readonly toastClassName: string;
}

function ErrorDetail({
  className,
  message,
  onDismiss,
  toastClassName,
}: ErrorDetailProps) {
  return (
    <>
      <div className={className}>예약 정보를 불러오지 못했습니다.</div>
      {message && (
        <div className={toastClassName}>
          <ToastHost
            closeLabel="오류 닫기"
            message={message}
            onClose={onDismiss}
          />
        </div>
      )}
    </>
  );
}

function GuestReservationDetail({
  actions,
  feedbackMessage,
  state,
}: Extract<ReservationDetailScreenProps, { variant: "guest" }>) {
  if (state.status === "loading") {
    return <div className={guestStyles.loading}>로딩 중...</div>;
  }

  if (state.status === "error") {
    return (
      <ErrorDetail
        className={requireCssModuleClass(guestStyles.error)}
        message={state.message}
        onDismiss={actions.onDismissError}
        toastClassName={requireCssModuleClass(guestStyles.toastContainer)}
      />
    );
  }

  if (state.status === "missing") {
    return <div className={guestStyles.error}>예약을 찾을 수 없습니다.</div>;
  }

  const { view } = state;

  return (
    <>
      <div className={guestStyles.container}>
        <button
          className={guestStyles.backButton}
          type="button"
          onClick={actions.onBackToProfile}
        >
          ← 돌아가기
        </button>

        <div className={guestStyles.content}>
          <div className={guestStyles.mainContent}>
            <section className={guestStyles.section}>
              <button
                aria-label="뒤로 가기"
                className={guestStyles.backButtonOnImage}
                type="button"
                onClick={actions.onBack}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <div className={guestStyles.accommodationCard}>
                {view.accommodation.thumbnailUrl && (
                  <img
                    src={view.accommodation.thumbnailUrl}
                    alt={view.accommodation.name}
                    className={guestStyles.accommodationImage}
                  />
                )}
                <div className={guestStyles.accommodationInfo}>
                  <p className={guestStyles.accommodationAddress}>
                    {view.addressLabel}
                  </p>
                  <div className={guestStyles.hostInfo}>
                    <span className={guestStyles.hostLabel}>호스트:</span>
                    <span className={guestStyles.hostName}>
                      {view.host.displayName}
                    </span>
                  </div>
                  <div className={guestStyles.dateInfo}>
                    <div className={guestStyles.dateItem}>
                      <span className={guestStyles.dateLabel}>체크인</span>
                      <div className={guestStyles.dateValue}>
                        <span>{view.checkIn.dateLabel}</span>
                        <span className={guestStyles.timeValue}>
                          {view.checkIn.timeLabel}
                        </span>
                      </div>
                    </div>
                    <div className={guestStyles.dateItem}>
                      <span className={guestStyles.dateLabel}>체크아웃</span>
                      <div className={guestStyles.dateValue}>
                        <span>{view.checkOut.dateLabel}</span>
                        <span className={guestStyles.timeValue}>
                          {view.checkOut.timeLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    aria-label="숙소로 이동하기"
                    className={guestStyles.accommodationBox}
                    type="button"
                    onClick={() =>
                      actions.onOpenAccommodation(view.accommodation.id)
                    }
                  >
                    <span className={guestStyles.accommodationBoxContent}>
                      <span>숙소로 이동하기</span>
                      <span className={guestStyles.accommodationBoxArrow}>
                        {" > "}
                      </span>
                    </span>
                  </button>
                  {view.canReview && (
                    <button
                      aria-label="리뷰 작성하기"
                      className={guestStyles.accommodationBox}
                      type="button"
                      onClick={() => actions.onOpenReview(view.reservationUid)}
                    >
                      <span className={guestStyles.accommodationBoxContent}>
                        <span>리뷰 작성하기</span>
                        <span className={guestStyles.accommodationBoxArrow}>
                          {" > "}
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className={guestStyles.section}>
              <div className={guestStyles.sectionTitleRow}>
                <h2 className={guestStyles.sectionTitle}>예약 세부정보</h2>
                <StatusBadge tone={view.status.tone}>
                  {view.status.label}
                </StatusBadge>
              </div>

              <div className={guestStyles.infoList}>
                <div className={guestStyles.infoItem}>
                  <span className={guestStyles.infoLabel}>게스트</span>
                  <span className={guestStyles.infoValue}>
                    {view.guestCountLabel}
                  </span>
                </div>
                <div className={guestStyles.infoItem}>
                  <span className={guestStyles.infoLabel}>예약 코드</span>
                  <span className={guestStyles.infoValue}>
                    {view.reservationCode}
                  </span>
                </div>
              </div>
            </section>

            <section className={guestStyles.section}>
              <div className={guestStyles.hostSection}>
                <div className={guestStyles.hostAvatar}>
                  {view.host.avatarUrl ? (
                    <img
                      src={view.host.avatarUrl}
                      alt={view.host.nickname}
                      className={guestStyles.hostAvatarImage}
                    />
                  ) : (
                    <span className={guestStyles.hostAvatarInitial}>
                      {view.host.avatarInitial}
                    </span>
                  )}
                </div>
                <div className={guestStyles.hostText}>
                  호스트: {view.host.displayName}
                </div>
              </div>
            </section>

            {view.payment && (
              <section className={guestStyles.section}>
                <div className={guestStyles.sectionTitleRow}>
                  <h2 className={guestStyles.sectionTitle}>결제 정보</h2>
                  <StatusBadge tone={view.payment.statusTone}>
                    {view.payment.statusLabel}
                  </StatusBadge>
                </div>
                <div className={guestStyles.infoList}>
                  <div className={guestStyles.infoItem}>
                    <span className={guestStyles.infoLabel}>결제 방법</span>
                    <span className={guestStyles.infoValue}>
                      {view.payment.methodLabel}
                    </span>
                  </div>
                  <div className={guestStyles.infoItem}>
                    <span className={guestStyles.infoLabel}>결제 금액</span>
                    <span className={guestStyles.infoValue}>
                      {view.payment.amountLabel}
                    </span>
                  </div>
                  {view.payment.approvedAtLabel && (
                    <div className={guestStyles.infoItem}>
                      <span className={guestStyles.infoLabel}>결제 일시</span>
                      <span className={guestStyles.infoValue}>
                        {view.payment.approvedAtLabel}
                      </span>
                    </div>
                  )}

                  {view.payment.virtualAccount && (
                    <div className={guestStyles.virtualAccountSection}>
                      <h3 className={guestStyles.virtualAccountTitle}>
                        가상계좌 입금 정보
                      </h3>
                      <div className={guestStyles.virtualAccountInfo}>
                        <div className={guestStyles.virtualAccountItem}>
                          <span className={guestStyles.virtualAccountLabel}>
                            은행
                          </span>
                          <span className={guestStyles.virtualAccountValue}>
                            {view.payment.virtualAccount.bankName}
                          </span>
                        </div>
                        <div className={guestStyles.virtualAccountItem}>
                          <span className={guestStyles.virtualAccountLabel}>
                            계좌번호
                          </span>
                          <span className={guestStyles.virtualAccountValue}>
                            {view.payment.virtualAccount.accountNumber}
                          </span>
                        </div>
                        <div className={guestStyles.virtualAccountItem}>
                          <span className={guestStyles.virtualAccountLabel}>
                            예금주
                          </span>
                          <span className={guestStyles.virtualAccountValue}>
                            {view.payment.virtualAccount.customerName}
                          </span>
                        </div>
                        <div className={guestStyles.virtualAccountItem}>
                          <span className={guestStyles.virtualAccountLabel}>
                            입금 기한
                          </span>
                          <span className={guestStyles.virtualAccountValue}>
                            {view.payment.virtualAccount.dueDateLabel}
                          </span>
                        </div>
                      </div>
                      <div className={guestStyles.virtualAccountNotice}>
                        <p>위 가상계좌로 입금 기한 내에 입금해주세요.</p>
                        <p>입금이 확인되면 예약이 확정됩니다.</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <div className={guestStyles.rightSection}>
            <div className={guestStyles.mapContainer}>
              {view.mapEmbedUrl ? (
                <iframe
                  className={guestStyles.map}
                  title="숙소 위치"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={view.mapEmbedUrl}
                />
              ) : (
                <div className={guestStyles.mapPlaceholder}>
                  지도를 불러올 수 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {feedbackMessage && (
        <div className={guestStyles.toastContainer}>
          <ToastHost
            closeLabel="오류 닫기"
            message={feedbackMessage}
            onClose={actions.onDismissFeedback}
          />
        </div>
      )}
    </>
  );
}

function HostReservationDetail({
  actions,
  state,
}: Extract<ReservationDetailScreenProps, { variant: "host" }>) {
  if (state.status === "loading") {
    return <div className={hostStyles.loading}>로딩 중...</div>;
  }

  if (state.status === "error") {
    return (
      <ErrorDetail
        className={requireCssModuleClass(hostStyles.error)}
        message={state.message}
        onDismiss={actions.onDismissError}
        toastClassName={requireCssModuleClass(hostStyles.toastContainer)}
      />
    );
  }

  if (state.status === "missing") {
    return <div className={hostStyles.error}>예약을 찾을 수 없습니다.</div>;
  }

  const { view } = state;

  return (
    <div className={hostStyles.container}>
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
    </div>
  );
}

export function ReservationDetailScreen(props: ReservationDetailScreenProps) {
  return props.variant === "guest" ? (
    <GuestReservationDetail {...props} />
  ) : (
    <HostReservationDetail {...props} />
  );
}
