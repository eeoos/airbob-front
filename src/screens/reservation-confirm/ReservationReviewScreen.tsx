import { toAccommodationBookingCouponViewModels } from "../../features/accommodations/detail/public";
import { useRef, useState } from "react";
import type {
  AccommodationAvailability,
  AccommodationMemberCoupon,
  AccommodationDetail,
} from "../../features/accommodations/detail/public";
import { calendarLocalDateToDate } from "../../shared/lib/calendarLocalDate";
import {
  Button,
  CounterStepper,
  DatePicker,
  Dialog,
  ImageWithFallback,
  PageContainer,
} from "../../shared/ui";
import type { BookingTransactionSnapshot } from "../../workflows/booking-payment/transaction/booking";
import {
  reviewDate,
  reviewDraftFromSnapshot,
  reviewGuests,
  reviewMoney,
  type ReservationReviewDraft,
} from "./reservationReviewModel";
import styles from "./ReservationReviewScreen.module.css";

type Editor = "dates" | "guests" | "coupon";
interface ReservationReviewScreenProps {
  readonly snapshot: BookingTransactionSnapshot;
  readonly detail: AccommodationDetail;
  readonly imageUrl: string;
  readonly availability: AccommodationAvailability | null;
  readonly availabilityLoading: boolean;
  readonly onRetryAvailability: () => void;
  readonly coupons: readonly AccommodationMemberCoupon[];
  readonly couponsLoading: boolean;
  readonly couponsError: boolean;
  readonly onRetryCoupons: () => void;
  readonly busy: boolean;
  readonly error: string | null;
  readonly canEdit: boolean;
  readonly needsNewQuote: boolean;
  readonly blocked: boolean;
  readonly onSave: (draft: ReservationReviewDraft) => Promise<boolean>;
  readonly onCheckout: () => void;
  readonly onExit: () => void;
  readonly onRefresh: () => void;
}

const dateKey = (date: Date | null) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";

export function ReservationReviewScreen({
  snapshot,
  detail,
  imageUrl,
  availability,
  availabilityLoading,
  onRetryAvailability,
  coupons,
  couponsLoading,
  couponsError,
  onRetryCoupons,
  busy,
  error,
  canEdit,
  needsNewQuote,
  blocked,
  onSave,
  onCheckout,
  onExit,
  onRefresh,
}: ReservationReviewScreenProps) {
  const [step, setStep] = useState<"review" | "confirm">("review");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState(() => reviewDraftFromSnapshot(snapshot));
  const [saved, setSaved] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const amount = reviewMoney(snapshot.amount, snapshot.currency);
  const couponViews = toAccommodationBookingCouponViewModels(coupons, {
    issuingCouponId: null,
    selectedCouponId: draft.couponId,
    totalPrice:
      Math.max(
        0,
        (Date.parse(draft.checkOut) - Date.parse(draft.checkIn)) / 86_400_000,
      ) * detail.basePrice,
  });
  const couponLabel =
    coupons.find((coupon) => coupon.id === snapshot.couponId)?.name ??
    snapshot.couponDisplayName;
  const openEditor = (next: Editor) => {
    setDraft(reviewDraftFromSnapshot(snapshot));
    setEditor(next);
    setSaved("");
  };
  const closeEditor = () => {
    if (!busy) setEditor(null);
  };
  const save = async () => {
    if (await onSave(draft)) {
      setEditor(null);
      setSaved("변경한 예약 조건과 요금을 반영했어요.");
    }
  };
  const continueReview = () => {
    if (step === "review") {
      setStep("confirm");
      headingRef.current?.focus();
    } else onCheckout();
  };
  const actionLabel = busy
    ? "예약 확인 중…"
    : needsNewQuote
      ? "최신 요금 다시 확인"
      : step === "review"
        ? "다음"
        : snapshot.paymentRequired
          ? "확인 및 결제"
          : "예약 확정하기";
  const action = needsNewQuote ? onRefresh : continueReview;
  const editButton = (kind: Editor, label: string) => (
    <button
      type="button"
      className={styles.changeButton}
      aria-label={`${label} 변경`}
      disabled={!canEdit || busy}
      onClick={() => openEditor(kind)}
    >
      변경
    </button>
  );
  const priceDetails = (
    <div className={styles.priceDetails}>
      <h2>요금 세부 내역</h2>
      <div className={styles.priceRow}>
        <span>
          {reviewMoney(snapshot.nightlyPrice, snapshot.currency)} ×{" "}
          {snapshot.nights}박
        </span>
        <span>{reviewMoney(snapshot.subtotal, snapshot.currency)}</span>
      </div>
      {snapshot.discountAmount > 0 && (
        <div className={`${styles.priceRow} ${styles.discount}`}>
          <span>쿠폰 할인</span>
          <span>
            −{reviewMoney(snapshot.discountAmount, snapshot.currency)}
          </span>
        </div>
      )}
      <div className={`${styles.priceRow} ${styles.totalRow}`}>
        <strong>
          총 결제 금액 <small>({snapshot.currency})</small>
        </strong>
        <strong>{amount}</strong>
      </div>
    </div>
  );

  return (
    <PageContainer variant="content" className={styles.page}>
      <div className={styles.headingRow}>
        <button
          className={styles.backButton}
          type="button"
          aria-label={
            step === "review" ? "숙소로 돌아가기" : "예약 검토로 돌아가기"
          }
          disabled={busy}
          onClick={step === "review" ? onExit : () => setStep("review")}
        >
          <span aria-hidden="true">←</span>
        </button>
        <div>
          <p className={styles.stepText}>
            {step === "review" ? "1" : "2"} / 2 · 예약 확인
          </p>
          <h1 ref={headingRef} tabIndex={-1}>
            {step === "review"
              ? "여행을 한 번 더 확인해요"
              : "이제, 여행을 시작해볼까요?"}
          </h1>
        </div>
      </div>
      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.tripCard} aria-label="예약 검토">
            <div className={styles.mobileStay}>
              <ImageWithFallback
                className={styles.mobilePhoto}
                src={imageUrl}
                alt=""
                fallback={<div className={styles.mobilePhoto} />}
              />
              <div>
                <h2>{detail.name}</h2>
                <p>
                  {detail.addressSummary.city} · {snapshot.nights}박
                </p>
              </div>
            </div>
            <h2 className={styles.sectionTitle}>여행 일정</h2>
            <div className={styles.detailRow}>
              <div>
                <h3>날짜</h3>
                <p>
                  {reviewDate(snapshot.checkIn)} ~{" "}
                  {reviewDate(snapshot.checkOut)}
                </p>
                <span className={styles.secondary}>{snapshot.nights}박</span>
              </div>
              {editButton("dates", "날짜")}
            </div>
            <div className={styles.detailRow}>
              <div>
                <h3>게스트</h3>
                <p>{reviewGuests(reviewDraftFromSnapshot(snapshot))}</p>
              </div>
              {editButton("guests", "게스트")}
            </div>
            <div className={styles.detailRow}>
              <div>
                <h3>쿠폰</h3>
                <p>
                  {snapshot.couponId !== null
                    ? couponLabel
                    : "사용할 쿠폰을 선택하세요"}
                </p>
                {snapshot.discountAmount > 0 && (
                  <span className={styles.discount}>
                    {reviewMoney(snapshot.discountAmount, snapshot.currency)}{" "}
                    할인 적용
                  </span>
                )}
              </div>
              {editButton("coupon", "쿠폰")}
            </div>
          </section>
          <section
            className={styles.paymentCard}
            aria-labelledby="review-payment-title"
          >
            <div className={styles.sectionHeading}>
              <span className={styles.stepNumber}>2</span>
              <h2 id="review-payment-title">결제 및 예약 확인</h2>
            </div>
            {step === "review" ? (
              <p className={styles.secondary}>
                일정과 요금을 확인한 뒤 다음 단계에서 결제를 진행해주세요.
              </p>
            ) : (
              <>
                <p className={styles.secondary}>
                  {snapshot.paymentRequired
                    ? "확인 및 결제를 누르면 토스페이먼츠 결제창이 열립니다."
                    : "전액 할인이 적용되어 추가 결제 없이 예약을 확정할 수 있어요."}
                </p>
                <div className={styles.stayRules}>
                  <h3>숙소 이용 안내</h3>
                  <p>
                    체크인 {detail.checkInTime.slice(0, 5)} 이후 · 체크아웃{" "}
                    {detail.checkOutTime.slice(0, 5)} 이전
                  </p>
                  <p>
                    게스트 최대 {detail.policy.maxOccupancy}명 · 숙소 현지 시간
                    기준
                  </p>
                </div>
                <p className={styles.notice}>
                  {snapshot.paymentRequired
                    ? "결제가 완료되면 예약이 확정됩니다. 결제 진행 시 예약 가능 여부와 최종 요금을 한 번 더 확인합니다."
                    : "예약 확정 시 예약 가능 여부와 최종 요금을 한 번 더 확인합니다."}
                </p>
              </>
            )}
          </section>
          <div className={styles.mobilePrice}>{priceDetails}</div>
          {saved && (
            <p className={styles.saved} role="status">
              {saved}
            </p>
          )}
          {error && editor === null && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
              {blocked && (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={onExit}
                >
                  {snapshot.reservationUid !== null
                    ? "예약 내역에서 확인"
                    : "숙소로 돌아가기"}
                </button>
              )}
            </div>
          )}
          <div className={styles.desktopAction}>
            <Button disabled={busy || blocked} onClick={action}>
              {actionLabel}
            </Button>
            <p className={styles.secondary}>아직 요금이 청구되지 않습니다.</p>
          </div>
        </div>
        <aside className={styles.summary} aria-label="숙소 및 요금 요약">
          <ImageWithFallback
            className={styles.heroPhoto}
            src={imageUrl}
            alt={detail.name}
            fallback={<div className={styles.heroPhoto} />}
          />
          <div className={styles.summaryBody}>
            <p className={styles.location}>
              {detail.addressSummary.city} · {detail.addressSummary.country}
            </p>
            <h2>{detail.name}</h2>
            {detail.reviewSummary.totalCount > 0 && (
              <p className={styles.rating}>
                <span aria-hidden="true">★</span>{" "}
                {detail.reviewSummary.averageRating.toFixed(2)}{" "}
                <span>· 후기 {detail.reviewSummary.totalCount}개</span>
              </p>
            )}
            {priceDetails}
            <p className={styles.summaryNote}>
              결제 진행 전까지 일정과 인원을 변경할 수 있어요.
            </p>
          </div>
        </aside>
      </div>
      <div className={styles.mobileAction}>
        <div
          className={styles.progress}
          aria-label={`예약 ${step === "review" ? "1" : "2"} / 2단계`}
        >
          <span />
          <span className={step === "confirm" ? styles.complete : undefined} />
        </div>
        <div className={styles.mobileActionInner}>
          <div>
            <strong>{amount}</strong>
            <span>{snapshot.nights}박 · 총 요금</span>
          </div>
          <Button disabled={busy || blocked} onClick={action}>
            {actionLabel}
          </Button>
        </div>
      </div>
      <Dialog
        isOpen={editor !== null}
        title={
          editor === "dates"
            ? "날짜 변경"
            : editor === "guests"
              ? "게스트 변경"
              : "쿠폰 선택"
        }
        onClose={closeEditor}
        closeOnBackdrop={!busy}
        size="custom"
        className={
          (editor === "dates" ? styles.dateDialog : styles.editorDialog) ?? ""
        }
        bodyClassName={styles.editorBody ?? ""}
        bodyPadding="none"
      >
        <div className={styles.editorContent}>
          {editor === "dates" && (
            <>
              <p className={styles.secondary}>
                여행 일정을 선택해주세요. 요금은 저장할 때 다시 확인합니다.
              </p>
              {availability && !availabilityLoading ? (
                <fieldset disabled={busy} className={styles.calendarFieldset}>
                  <DatePicker
                    variant="compact"
                    hideFooter
                    checkIn={calendarLocalDateToDate(draft.checkIn)}
                    checkOut={calendarLocalDateToDate(draft.checkOut)}
                    onDateSelect={(checkIn, checkOut) =>
                      setDraft({
                        ...draft,
                        checkIn: dateKey(checkIn),
                        checkOut: dateKey(checkOut),
                      })
                    }
                    onClose={closeEditor}
                    onEscape={closeEditor}
                    selectionWindow={{
                      startInclusive: availability.bookingWindowStartInclusive,
                      endExclusive: availability.bookingWindowEndExclusive,
                    }}
                    disabledRanges={availability.unavailableRanges.map(
                      (range) => ({
                        startInclusive: range.startDate,
                        endExclusive: range.endDateExclusive,
                      }),
                    )}
                  />
                </fieldset>
              ) : (
                <div className={styles.empty}>
                  <p>
                    {availabilityLoading
                      ? "예약 가능한 날짜를 확인하고 있어요."
                      : "예약 가능한 날짜를 불러오지 못했어요."}
                  </p>
                  {!availabilityLoading && (
                    <Button variant="secondary" onClick={onRetryAvailability}>
                      다시 시도
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
          {editor === "guests" && (
            <>
              <p className={styles.secondary}>
                게스트 최대 {detail.policy.maxOccupancy}명. 유아와 반려동물은
                별도 기준이 적용됩니다.
              </p>
              {(
                [
                  [
                    "adultCount",
                    "성인",
                    "13세 이상",
                    1,
                    detail.policy.maxOccupancy - draft.childCount,
                  ],
                  [
                    "childCount",
                    "어린이",
                    "2~12세",
                    0,
                    detail.policy.maxOccupancy - draft.adultCount,
                  ],
                  [
                    "infantCount",
                    "유아",
                    "2세 미만",
                    0,
                    detail.policy.infantOccupancy,
                  ],
                  [
                    "petCount",
                    "반려동물",
                    detail.policy.petOccupancy ? "동반 가능" : "동반 불가",
                    0,
                    detail.policy.petOccupancy,
                  ],
                ] as const
              ).map(([key, label, description, min, max]) => (
                <div className={styles.guestRow} key={key}>
                  <div>
                    <h3>{label}</h3>
                    <p>{description}</p>
                  </div>
                  <CounterStepper
                    value={draft[key]}
                    min={busy ? draft[key] : min}
                    max={busy ? draft[key] : max}
                    onChange={(value) => setDraft({ ...draft, [key]: value })}
                    decrementLabel={`${label} 줄이기`}
                    incrementLabel={`${label} 늘리기`}
                  />
                </div>
              ))}
            </>
          )}
          {editor === "coupon" && (
            <>
              <p className={styles.secondary}>
                숙박 일정과 금액에 따라 적용 가능한 할인이 달라질 수 있어요.
              </p>
              <label className={styles.couponOption}>
                <input
                  type="radio"
                  name="review-coupon"
                  checked={draft.couponId === null}
                  disabled={busy}
                  onChange={() => setDraft({ ...draft, couponId: null })}
                />
                <span>쿠폰 사용 안 함</span>
              </label>
              {couponsLoading ? (
                <p role="status">쿠폰을 불러오고 있어요.</p>
              ) : couponsError ? (
                <div className={styles.empty}>
                  <p>쿠폰을 불러오지 못했어요.</p>
                  <Button variant="secondary" onClick={onRetryCoupons}>
                    쿠폰 다시 불러오기
                  </Button>
                </div>
              ) : (
                couponViews.map((coupon) => (
                  <label
                    className={styles.couponOption}
                    key={coupon.id}
                    htmlFor={`review-coupon-${coupon.id}`}
                    aria-label={coupon.name}
                  >
                    <input
                      id={`review-coupon-${coupon.id}`}
                      type="radio"
                      name="review-coupon"
                      checked={draft.couponId === coupon.id}
                      disabled={busy || !coupon.isActionEnabled}
                      onChange={() =>
                        setDraft({ ...draft, couponId: coupon.id })
                      }
                    />
                    <span>
                      <strong>{coupon.name}</strong>
                      <small>
                        {coupon.metadataLabel}
                        {!coupon.isActionEnabled && ` · ${coupon.actionLabel}`}
                      </small>
                    </span>
                  </label>
                ))
              )}
              {!couponsLoading && !couponsError && coupons.length === 0 && (
                <p className={styles.empty}>
                  현재 사용할 수 있는 쿠폰이 없어요.
                </p>
              )}
            </>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <div className={styles.editorFooter}>
          <button
            type="button"
            className={styles.textButton}
            disabled={busy}
            onClick={closeEditor}
          >
            취소
          </button>
          <Button
            disabled={
              busy ||
              (editor === "dates" &&
                (!draft.checkIn ||
                  !draft.checkOut ||
                  !availability ||
                  availabilityLoading)) ||
              (editor === "coupon" && couponsLoading)
            }
            onClick={() => void save()}
          >
            {busy ? "요금 확인 중…" : "저장"}
          </Button>
        </div>
      </Dialog>
    </PageContainer>
  );
}
