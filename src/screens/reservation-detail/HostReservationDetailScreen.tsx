import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
import {
  Button,
  ImageWithFallback,
  PageContainer,
  RetryableErrorState,
  Skeleton,
  StatusBadge,
  TerminalErrorState,
  stateViewRecipes,
} from "../../shared/ui";
import hostStyles from "./HostReservationDetailScreen.module.css";
import type { HostReservationDetailScreenProps } from "./reservationDetailViewContract";

function HostReservationDetailLoading() {
  return (
    <PageContainer className={hostStyles.loading} variant="content">
      <section {...stateViewRecipes.loading}>
        <span className={hostStyles.srOnly}>
          호스트 예약을 불러오는 중입니다.
        </span>
        <Skeleton className={hostStyles.loadingBack} />
        <div className={hostStyles.loadingHero}>
          <div>
            <Skeleton className={hostStyles.loadingBadge} />
            <Skeleton className={hostStyles.loadingTitle} />
            <Skeleton className={hostStyles.loadingLine} />
          </div>
          <Skeleton className={hostStyles.loadingAvatar} />
        </div>
        <div className={hostStyles.loadingGrid}>
          <Skeleton className={hostStyles.loadingPanel} />
          <Skeleton className={hostStyles.loadingPanelSmall} />
        </div>
      </section>
    </PageContainer>
  );
}

function GuestImageFallback({
  initial,
  nickname,
}: {
  readonly initial: string;
  readonly nickname: string;
}) {
  return (
    <span
      aria-label={`${nickname} 프로필 이미지 없음`}
      className={hostStyles.profileImagePlaceholder}
      role="img"
    >
      {initial}
    </span>
  );
}

function AccommodationImageFallback({ name }: { readonly name: string }) {
  return (
    <span
      aria-label={`${name} 숙소 이미지 없음`}
      className={hostStyles.accommodationThumbnailPlaceholder}
      role="img"
    >
      <svg aria-hidden="true" viewBox="0 0 32 32">
        <path d="M5 26V13.5L16 5l11 8.5V26a1 1 0 0 1-1 1h-7v-8h-6v8H6a1 1 0 0 1-1-1Z" />
      </svg>
      <span>사진 준비 중</span>
    </span>
  );
}

export function HostReservationDetailScreen({
  actions,
  state,
}: HostReservationDetailScreenProps) {
  if (state.status === "loading") {
    return <HostReservationDetailLoading />;
  }

  if (state.status === "error") {
    return (
      <PageContainer className={hostStyles.stateShell} variant="content">
        <RetryableErrorState
          title="예약 정보를 불러오지 못했어요"
          description={state.message ?? "잠시 후 다시 시도해주세요."}
          action={
            <div className={hostStyles.stateActions}>
              <Button onClick={actions.onRetry}>다시 시도</Button>
              <Button onClick={actions.onBack} variant="secondary">
                예약 목록으로
              </Button>
            </div>
          }
        />
      </PageContainer>
    );
  }

  if (state.status === "missing") {
    return (
      <PageContainer className={hostStyles.stateShell} variant="content">
        <TerminalErrorState
          title="예약을 찾을 수 없습니다."
          action={
            <Button onClick={actions.onBack} variant="secondary">
              예약 목록으로
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const { view } = state;

  return (
    <PageContainer className={hostStyles.container} variant="content">
      <button
        className={hostStyles.backButton}
        onClick={actions.onBack}
        type="button"
      >
        <span aria-hidden="true">←</span>
        <span>예약 목록으로</span>
      </button>

      <header
        aria-labelledby="host-reservation-title"
        className={hostStyles.hero}
      >
        <div className={hostStyles.heroCopy}>
          <div className={hostStyles.heroMeta}>
            <span className={hostStyles.eyebrow}>호스트 예약 원장</span>
            <StatusBadge
              className={requireCssModuleClass(hostStyles.statusBadge)}
              size="sm"
              tone={view.statusTone}
            >
              {view.statusLabel}
            </StatusBadge>
          </div>
          <h1 className={hostStyles.title} id="host-reservation-title">
            {view.guest.nickname}님의 예약
          </h1>
          <p className={hostStyles.guestNights}>{view.guestStaySummaryLabel}</p>
        </div>
        <div className={hostStyles.profileImageFrame}>
          <ImageWithFallback
            alt={view.guest.nickname}
            className={hostStyles.profileImage}
            fallback={
              <GuestImageFallback
                initial={view.guest.avatarInitial}
                nickname={view.guest.nickname}
              />
            }
            src={view.guest.avatarUrl}
          />
        </div>
      </header>

      <div className={hostStyles.contentGrid}>
        <main className={hostStyles.mainColumn}>
          <section
            aria-labelledby="host-reservation-stay-title"
            className={hostStyles.section}
          >
            <div className={hostStyles.sectionHeading}>
              <span className={hostStyles.sectionKicker}>숙소</span>
              <h2
                className={hostStyles.sectionTitle}
                id="host-reservation-stay-title"
              >
                머무는 곳
              </h2>
            </div>
            <button
              aria-label={`${view.accommodation.name} 숙소로 이동하기`}
              className={hostStyles.accommodationInfo}
              type="button"
              onClick={() => actions.onOpenAccommodation(view.accommodation.id)}
            >
              <span className={hostStyles.accommodationMedia}>
                <ImageWithFallback
                  alt={view.accommodation.name}
                  className={hostStyles.accommodationThumbnail}
                  fallback={
                    <AccommodationImageFallback
                      name={view.accommodation.name}
                    />
                  }
                  src={view.accommodation.thumbnailUrl}
                />
              </span>
              <span className={hostStyles.accommodationDetails}>
                <strong className={hostStyles.accommodationInfoName}>
                  {view.accommodation.name}
                </strong>
                <span className={hostStyles.accommodationInfoAddress}>
                  {view.addressLabel}
                </span>
              </span>
              <span
                className={hostStyles.accommodationArrow}
                aria-hidden="true"
              >
                →
              </span>
            </button>
          </section>

          <section
            aria-labelledby="host-reservation-details-title"
            className={hostStyles.section}
          >
            <div className={hostStyles.sectionHeading}>
              <span className={hostStyles.sectionKicker}>예약</span>
              <h2
                className={hostStyles.sectionTitle}
                id="host-reservation-details-title"
              >
                체크인 정보
              </h2>
            </div>
            <dl className={hostStyles.detailsList}>
              <div className={hostStyles.detailItem}>
                <dt className={hostStyles.detailLabel}>게스트</dt>
                <dd className={hostStyles.detailValue}>
                  {view.guestCountLabel}
                </dd>
              </div>
              <div className={hostStyles.detailItem}>
                <dt className={hostStyles.detailLabel}>체크인</dt>
                <dd className={hostStyles.detailValue}>
                  {view.checkInDateLabel}
                </dd>
              </div>
              <div className={hostStyles.detailItem}>
                <dt className={hostStyles.detailLabel}>체크아웃</dt>
                <dd className={hostStyles.detailValue}>
                  {view.checkOutDateLabel}
                </dd>
              </div>
              <div className={hostStyles.detailItem}>
                <dt className={hostStyles.detailLabel}>예약일</dt>
                <dd className={hostStyles.detailValue}>
                  {view.createdAtDateLabel}
                </dd>
              </div>
              <div className={hostStyles.detailItem}>
                <dt className={hostStyles.detailLabel}>예약 코드</dt>
                <dd
                  className={`${hostStyles.detailValue} ${hostStyles.reservationCode}`}
                >
                  {view.reservationCode}
                </dd>
              </div>
            </dl>
          </section>
        </main>

        <aside
          aria-labelledby="host-reservation-payment-title"
          className={hostStyles.summaryColumn}
        >
          <div className={hostStyles.sectionHeading}>
            <span className={hostStyles.sectionKicker}>정산</span>
            <h2
              className={hostStyles.sectionTitle}
              id="host-reservation-payment-title"
            >
              요금 세부 정보
            </h2>
          </div>
          {view.payment ? (
            <dl className={hostStyles.feeDetails}>
              <div className={hostStyles.feeItem}>
                <dt className={hostStyles.feeLabel}>숙박 요금</dt>
                <dd className={hostStyles.feeValue}>
                  {view.payment.nights}박 × {view.payment.pricePerNightLabel}
                </dd>
              </div>
              <div className={hostStyles.feeTotal}>
                <dt className={hostStyles.feeTotalLabel}>총액 KRW</dt>
                <dd className={hostStyles.feeTotalValue}>
                  {view.payment.totalAmountLabel}
                </dd>
              </div>
            </dl>
          ) : (
            <p className={hostStyles.paymentUnavailable}>
              표시할 결제 정보가 없습니다.
            </p>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}
