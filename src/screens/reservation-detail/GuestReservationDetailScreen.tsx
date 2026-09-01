import {
  ImageWithFallback,
  Skeleton,
  stateViewRecipes,
  StatusBadge,
  TerminalErrorState,
  ToastHost,
} from "../../shared/ui";
import guestStyles from "./GuestReservationDetailScreen.module.css";
import type { GuestReservationDetailScreenProps } from "./reservationDetailViewContract";

function AccommodationImageFallback({ name }: { readonly name: string }) {
  return (
    <div
      aria-label={`${name} 이미지 없음`}
      className={guestStyles.accommodationImageFallback}
      role="img"
    >
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <path d="M8 14a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V14Z" />
        <path d="m11 34 9-10 7 7 4-5 7 8" />
        <circle cx="31" cy="17" r="3" />
      </svg>
      <span>숙소 사진 준비 중</span>
    </div>
  );
}

function HostImageFallback({
  initial,
  nickname,
}: {
  readonly initial: string;
  readonly nickname: string;
}) {
  return (
    <span
      aria-label={`${nickname} 프로필 이미지 없음`}
      className={guestStyles.hostAvatarInitial}
      role="img"
    >
      {initial}
    </span>
  );
}

function GuestReservationDetailLoading() {
  return (
    <div className={guestStyles.loading} {...stateViewRecipes.loading}>
      <div
        className={guestStyles.loadingLedger}
        data-testid="guest-reservation-loading-skeletons"
      >
        <span className={guestStyles.loadingStatus}>로딩 중...</span>
        <Skeleton className={guestStyles.loadingHero} />
        <div className={guestStyles.loadingSection}>
          <Skeleton className={guestStyles.loadingHeading} />
          <Skeleton className={guestStyles.loadingLine} />
          <Skeleton className={guestStyles.loadingLineShort} />
        </div>
        <div className={guestStyles.loadingSection}>
          <Skeleton className={guestStyles.loadingHeading} />
          <Skeleton className={guestStyles.loadingLine} />
        </div>
      </div>
      <Skeleton className={guestStyles.loadingMap} />
    </div>
  );
}

function GuestReservationTerminal({
  announce,
  title,
}: {
  readonly announce: boolean;
  readonly title: string;
}) {
  return (
    <div className={guestStyles.stateShell}>
      <TerminalErrorState
        aria-live={announce ? "assertive" : "off"}
        className={guestStyles.stateView}
        role={announce ? "alert" : "group"}
        title={title}
      />
    </div>
  );
}

export function GuestReservationDetailScreen({
  actions,
  feedbackMessage,
  state,
}: GuestReservationDetailScreenProps) {
  if (state.status === "loading") {
    return <GuestReservationDetailLoading />;
  }

  if (state.status === "error") {
    return (
      <>
        <GuestReservationTerminal
          announce={false}
          title="예약 정보를 불러오지 못했습니다."
        />
        {state.message && (
          <div className={guestStyles.toastContainer}>
            <ToastHost
              closeLabel="오류 닫기"
              message={state.message}
              onClose={actions.onDismissError}
            />
          </div>
        )}
      </>
    );
  }

  if (state.status === "missing") {
    return (
      <GuestReservationTerminal announce title="예약을 찾을 수 없습니다." />
    );
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
          <span aria-hidden="true">←</span>
          <span>돌아가기</span>
        </button>

        <div className={guestStyles.content}>
          <div className={guestStyles.mainContent}>
            <section
              aria-labelledby="guest-reservation-trip-title"
              className={`${guestStyles.section} ${guestStyles.heroSection}`}
            >
              <button
                aria-label="뒤로 가기"
                className={guestStyles.backButtonOnImage}
                type="button"
                onClick={actions.onBack}
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>

              <div className={guestStyles.accommodationCard}>
                <div className={guestStyles.accommodationMedia}>
                  <ImageWithFallback
                    alt={view.accommodation.name}
                    className={guestStyles.accommodationImage}
                    fallback={
                      <AccommodationImageFallback
                        name={view.accommodation.name}
                      />
                    }
                    src={view.accommodation.thumbnailUrl}
                  />
                </div>
                <div className={guestStyles.accommodationInfo}>
                  <div className={guestStyles.heroMeta}>
                    <span className={guestStyles.eyebrow}>여행 원장</span>
                    <StatusBadge tone={view.status.tone}>
                      {view.status.label}
                    </StatusBadge>
                  </div>
                  <h1
                    className={guestStyles.accommodationTitle}
                    id="guest-reservation-trip-title"
                  >
                    {view.accommodation.name}
                  </h1>
                  <p className={guestStyles.accommodationAddress}>
                    {view.addressLabel}
                  </p>
                  <p className={guestStyles.hostInfo}>
                    호스트: <strong>{view.host.displayName}</strong>
                  </p>
                  <button
                    aria-label="숙소로 이동하기"
                    className={guestStyles.accommodationBox}
                    type="button"
                    onClick={() =>
                      actions.onOpenAccommodation(view.accommodation.id)
                    }
                  >
                    <span>숙소로 이동하기</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </section>

            <section
              aria-labelledby="guest-reservation-itinerary-title"
              className={guestStyles.section}
            >
              <div className={guestStyles.sectionHeading}>
                <span className={guestStyles.sectionKicker}>일정</span>
                <h2
                  className={guestStyles.sectionTitle}
                  id="guest-reservation-itinerary-title"
                >
                  여행 일정
                </h2>
              </div>
              <dl className={guestStyles.dateInfo}>
                <div className={guestStyles.dateItem}>
                  <dt className={guestStyles.dateLabel}>체크인</dt>
                  <dd className={guestStyles.dateValue}>
                    <span>{view.checkIn.dateLabel}</span>
                    <span className={guestStyles.timeValue}>
                      {view.checkIn.timeLabel}
                    </span>
                  </dd>
                </div>
                <div className={guestStyles.dateItem}>
                  <dt className={guestStyles.dateLabel}>체크아웃</dt>
                  <dd className={guestStyles.dateValue}>
                    <span>{view.checkOut.dateLabel}</span>
                    <span className={guestStyles.timeValue}>
                      {view.checkOut.timeLabel}
                    </span>
                  </dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="guest-reservation-details-title"
              className={guestStyles.section}
            >
              <div className={guestStyles.sectionHeading}>
                <span className={guestStyles.sectionKicker}>예약</span>
                <h2
                  className={guestStyles.sectionTitle}
                  id="guest-reservation-details-title"
                >
                  예약 세부정보
                </h2>
              </div>
              <dl className={guestStyles.infoList}>
                <div className={guestStyles.infoItem}>
                  <dt className={guestStyles.infoLabel}>게스트</dt>
                  <dd className={guestStyles.infoValue}>
                    {view.guestCountLabel}
                  </dd>
                </div>
                <div className={guestStyles.infoItem}>
                  <dt className={guestStyles.infoLabel}>예약 코드</dt>
                  <dd
                    className={`${guestStyles.infoValue} ${guestStyles.reservationCode}`}
                  >
                    {view.reservationCode}
                  </dd>
                </div>
              </dl>
              {view.canReview && (
                <button
                  aria-label="리뷰 작성하기"
                  className={guestStyles.accommodationBox}
                  type="button"
                  onClick={() => actions.onOpenReview(view.reservationUid)}
                >
                  <span>리뷰 작성하기</span>
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </section>

            <section
              aria-labelledby="guest-reservation-host-title"
              className={guestStyles.section}
            >
              <div className={guestStyles.sectionHeading}>
                <span className={guestStyles.sectionKicker}>호스트</span>
                <h2
                  className={guestStyles.sectionTitle}
                  id="guest-reservation-host-title"
                >
                  여행을 맞이하는 사람
                </h2>
              </div>
              <div className={guestStyles.hostSection}>
                <div className={guestStyles.hostAvatar}>
                  <ImageWithFallback
                    alt={view.host.nickname}
                    className={guestStyles.hostAvatarImage}
                    fallback={
                      <HostImageFallback
                        initial={view.host.avatarInitial}
                        nickname={view.host.nickname}
                      />
                    }
                    src={view.host.avatarUrl}
                  />
                </div>
                <p className={guestStyles.hostText}>
                  호스트: <strong>{view.host.displayName}</strong>
                </p>
              </div>
            </section>

            {view.payment && (
              <section
                aria-labelledby="guest-reservation-payment-title"
                className={guestStyles.section}
              >
                <div className={guestStyles.sectionTitleRow}>
                  <div className={guestStyles.sectionHeading}>
                    <span className={guestStyles.sectionKicker}>결제</span>
                    <h2
                      className={guestStyles.sectionTitle}
                      id="guest-reservation-payment-title"
                    >
                      결제 정보
                    </h2>
                  </div>
                  <StatusBadge tone={view.payment.statusTone}>
                    {view.payment.statusLabel}
                  </StatusBadge>
                </div>
                <dl className={guestStyles.infoList}>
                  <div className={guestStyles.infoItem}>
                    <dt className={guestStyles.infoLabel}>결제 방법</dt>
                    <dd className={guestStyles.infoValue}>
                      {view.payment.methodLabel}
                    </dd>
                  </div>
                  <div className={guestStyles.infoItem}>
                    <dt className={guestStyles.infoLabel}>결제 금액</dt>
                    <dd
                      className={`${guestStyles.infoValue} ${guestStyles.paymentAmount}`}
                    >
                      {view.payment.amountLabel}
                    </dd>
                  </div>
                  {view.payment.approvedAtLabel && (
                    <div className={guestStyles.infoItem}>
                      <dt className={guestStyles.infoLabel}>결제 일시</dt>
                      <dd className={guestStyles.infoValue}>
                        {view.payment.approvedAtLabel}
                      </dd>
                    </div>
                  )}
                </dl>

                {view.payment.virtualAccount && (
                  <div className={guestStyles.virtualAccountSection}>
                    <h3 className={guestStyles.virtualAccountTitle}>
                      가상계좌 입금 정보
                    </h3>
                    <dl className={guestStyles.virtualAccountInfo}>
                      <div className={guestStyles.virtualAccountItem}>
                        <dt className={guestStyles.virtualAccountLabel}>
                          은행
                        </dt>
                        <dd className={guestStyles.virtualAccountValue}>
                          {view.payment.virtualAccount.bankName}
                        </dd>
                      </div>
                      <div className={guestStyles.virtualAccountItem}>
                        <dt className={guestStyles.virtualAccountLabel}>
                          계좌번호
                        </dt>
                        <dd className={guestStyles.virtualAccountValue}>
                          {view.payment.virtualAccount.accountNumber}
                        </dd>
                      </div>
                      <div className={guestStyles.virtualAccountItem}>
                        <dt className={guestStyles.virtualAccountLabel}>
                          예금주
                        </dt>
                        <dd className={guestStyles.virtualAccountValue}>
                          {view.payment.virtualAccount.customerName}
                        </dd>
                      </div>
                      <div className={guestStyles.virtualAccountItem}>
                        <dt className={guestStyles.virtualAccountLabel}>
                          입금 기한
                        </dt>
                        <dd className={guestStyles.virtualAccountValue}>
                          {view.payment.virtualAccount.dueDateLabel}
                        </dd>
                      </div>
                    </dl>
                    <div className={guestStyles.virtualAccountNotice}>
                      <p>위 가상계좌로 입금 기한 내에 입금해주세요.</p>
                      <p>입금이 확인되면 예약이 확정됩니다.</p>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside
            aria-labelledby="guest-reservation-map-title"
            className={guestStyles.rightSection}
          >
            <div className={guestStyles.mapHeader}>
              <span className={guestStyles.sectionKicker}>여행지</span>
              <h2
                className={guestStyles.mapTitle}
                id="guest-reservation-map-title"
              >
                숙소 위치
              </h2>
            </div>
            <div className={guestStyles.mapContainer}>
              {view.mapEmbedUrl ? (
                <iframe
                  allowFullScreen
                  className={guestStyles.map}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={view.mapEmbedUrl}
                  title="숙소 위치"
                />
              ) : (
                <div
                  aria-label="숙소 위치 지도를 불러올 수 없습니다."
                  className={guestStyles.mapPlaceholder}
                  role="img"
                >
                  <span aria-hidden="true" className={guestStyles.mapPin}>
                    ·
                  </span>
                  <span>지도를 불러올 수 없습니다.</span>
                </div>
              )}
            </div>
          </aside>
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
