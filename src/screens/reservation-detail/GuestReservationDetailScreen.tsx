import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
import { StatusBadge, ToastHost } from "../../shared/ui";
import guestStyles from "./GuestReservationDetailScreen.module.css";
import { ReservationDetailError } from "./ReservationDetailError";
import type { GuestReservationDetailScreenProps } from "./reservationDetailViewContract";

export function GuestReservationDetailScreen({
  actions,
  feedbackMessage,
  state,
}: GuestReservationDetailScreenProps) {
  if (state.status === "loading") {
    return <div className={guestStyles.loading}>로딩 중...</div>;
  }

  if (state.status === "error") {
    return (
      <ReservationDetailError
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
