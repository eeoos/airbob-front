import { useRef, useState } from "react";
import {
  calculateAccommodationCouponDiscount,
  useAccommodationDetailReadQuery,
  useAccommodationAvailabilityReadQuery,
  useValidCouponsReadQuery,
  type AccommodationDetailQueryOptions,
} from "../../features/accommodations/detail/public";
import { Button, LoadingState, RetryableErrorState } from "../../shared/ui";
import type {
  BookingTransactionHandle,
  BookingTransactionSnapshot,
  BookingTransactionRouteLease,
  BookingTransactionWorkflow,
} from "../../workflows/booking-payment/transaction/booking";
import { ReservationReviewScreen } from "./ReservationReviewScreen";
import {
  reviewDraftFromSnapshot,
  reviewFailureMessage,
  type ReservationReviewDraft,
} from "./reservationReviewModel";

interface ReservationReviewControllerProps {
  readonly handle: BookingTransactionHandle;
  readonly snapshot: BookingTransactionSnapshot;
  readonly workflow: BookingTransactionWorkflow;
  readonly routeLease: BookingTransactionRouteLease;
  readonly scope: AccommodationDetailQueryOptions["scope"];
  readonly resolveImageUrl: (path: string | null) => string;
  readonly onFlowHandleChange: (handle: BookingTransactionHandle) => boolean;
  readonly onCheckoutReady: (
    handle: BookingTransactionHandle,
    snapshot: BookingTransactionSnapshot,
  ) => boolean;
  readonly onTerminal: (
    handle: BookingTransactionHandle,
    snapshot: BookingTransactionSnapshot,
    lease: BookingTransactionRouteLease,
  ) => Promise<boolean>;
  readonly onExit: (snapshot: BookingTransactionSnapshot) => void;
}

export function ReservationReviewController({
  handle: initialHandle,
  snapshot: initialSnapshot,
  workflow,
  routeLease,
  scope,
  resolveImageUrl,
  onFlowHandleChange,
  onCheckoutReady,
  onTerminal,
  onExit,
}: ReservationReviewControllerProps) {
  const options = { accommodationId: initialSnapshot.accommodationId, scope };
  const detailQuery = useAccommodationDetailReadQuery(options);
  const availabilityQuery = useAccommodationAvailabilityReadQuery(options);
  const couponsQuery = useValidCouponsReadQuery({ scope });
  const [handle, setHandle] = useState(initialHandle);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsNewQuote, setNeedsNewQuote] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const active = useRef(false);
  const detail = detailQuery.data;
  const availability = availabilityQuery.data;

  const save = async (draft: ReservationReviewDraft): Promise<boolean> => {
    if (active.current || !detail || blocked) return false;
    if (!availability) {
      setError("예약 가능한 날짜를 확인한 뒤 다시 저장해주세요.");
      void availabilityQuery.refetch();
      return false;
    }
    active.current = true;
    setBusy(true);
    setError(null);
    try {
      const coupon = couponsQuery.data?.coupons.find(
        (item) => item.id === draft.couponId,
      );
      const nights =
        (Date.parse(draft.checkOut) - Date.parse(draft.checkIn)) / 86_400_000;
      const discount = coupon
        ? calculateAccommodationCouponDiscount(
            coupon,
            nights * detail.basePrice,
          )
        : 0;
      const input = {
        handle,
        routeLease,
        intent: {
          ...draft,
          type: "reservation.start" as const,
          accommodationId: detail.id,
        },
        accommodation: {
          id: detail.id,
          maxOccupancy: detail.policy.maxOccupancy,
          maxInfants: detail.policy.infantOccupancy,
          maxPets: detail.policy.petOccupancy,
        },
        availability,
        appliedCoupon: coupon
          ? { id: coupon.id, name: coupon.name, discount }
          : null,
        publishPreparedHandle: onFlowHandleChange,
      };
      const result = needsNewQuote
        ? await workflow.quote(input)
        : await workflow.reviseQuote(input);
      if (!routeLease.isCurrent()) return false;
      if (result.status === "quoted") {
        if (!onFlowHandleChange(result.handle)) {
          setBlocked(true);
          setError(
            "예약 정보를 저장하지 못했습니다. 숙소에서 다시 시작해주세요.",
          );
          return false;
        }
        setHandle(result.handle);
        setSnapshot(result.snapshot);
        setNeedsNewQuote(false);
        return true;
      }
      if (
        result.status === "blocked" &&
        result.reason === "recovery-expired" &&
        snapshot.phase === "quoted"
      ) {
        setNeedsNewQuote(true);
        setError(
          "요금 확인 시간이 지났습니다. 저장을 눌러 최신 요금을 다시 확인해주세요.",
        );
      } else if (result.status === "invalid") setError(result.error.message);
      else if (
        result.status === "definitive-failure" ||
        result.status === "retryable-error"
      )
        setError(reviewFailureMessage(result.failure.code));
      else if (result.status !== "stale" && result.status !== "busy") {
        setBlocked(true);
        setError(
          "예약 정보를 다시 확인해야 합니다. 숙소로 돌아가 다시 시작해주세요.",
        );
      }
      return false;
    } finally {
      active.current = false;
      if (routeLease.isCurrent()) setBusy(false);
    }
  };

  const checkout = async () => {
    if (active.current || needsNewQuote || blocked) return;
    active.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await workflow.checkout({ handle, routeLease });
      if (!routeLease.isCurrent()) return;
      if (
        result.status === "payment-ready" ||
        result.status === "complimentary" ||
        result.status === "reservation-status"
      ) {
        setSnapshot(result.snapshot);
        setHandle(result.handle);
        if (!onFlowHandleChange(result.handle)) {
          setBlocked(true);
          setError(
            "진행 중인 예약을 확인해야 합니다. 예약 내역을 확인해주세요.",
          );
          return;
        }
        if (result.status === "payment-ready") {
          if (!onCheckoutReady(result.handle, result.snapshot)) {
            setBlocked(true);
            setError(
              "결제 화면을 열지 못했습니다. 예약 내역에서 진행 중인 예약을 확인해주세요.",
            );
          }
        } else if (
          !(await onTerminal(result.handle, result.snapshot, routeLease))
        ) {
          setBlocked(true);
          setError(
            "예약 결과를 확인하고 있습니다. 예약 내역에서 확인해주세요.",
          );
        }
        return;
      }
      if (result.status === "definitive-failure") {
        setNeedsNewQuote(true);
        setError(reviewFailureMessage(result.failure.code));
        return;
      }
      if (
        result.status === "blocked" &&
        result.reason === "recovery-expired" &&
        snapshot.phase === "quoted"
      ) {
        setNeedsNewQuote(true);
        setError(reviewFailureMessage("R018"));
        return;
      }
      if (result.status === "retryable-error") {
        const loaded = workflow.load({ handle, routeLease });
        if (loaded.status === "ready") setSnapshot(loaded.snapshot);
        setError(
          "예약 처리 결과를 확인하지 못했습니다. 같은 요청을 다시 확인해주세요.",
        );
        return;
      }
      if (result.status === "unsupported-payment") {
        setError(
          "현재 선택한 통화나 금액으로 결제할 수 없습니다. 예약 조건을 변경해주세요.",
        );
        return;
      }
      if (result.status !== "busy" && result.status !== "stale") {
        setBlocked(true);
        setError(
          "예약 정보를 다시 확인해야 합니다. 숙소로 돌아가 확인해주세요.",
        );
      }
    } finally {
      active.current = false;
      if (routeLease.isCurrent()) setBusy(false);
    }
  };

  const exit = () => {
    if (active.current) return;
    if (blocked && snapshot.reservationUid !== null) {
      onExit(snapshot);
      return;
    }
    const result = workflow.abandonUnheld({ handle, routeLease });
    if (
      result.status === "abandoned" ||
      result.status === "missing" ||
      (blocked && snapshot.phase === "quoted") ||
      needsNewQuote
    )
      onExit(snapshot);
    else {
      setBlocked(true);
      setError(
        "진행 중인 예약 상태를 확인해야 합니다. 결제 확인을 다시 시도해주세요.",
      );
    }
  };

  if (!detail) {
    return detailQuery.isError ? (
      <RetryableErrorState
        title="숙소 정보를 불러오지 못했어요"
        description="잠시 후 다시 시도해주세요."
        action={
          <Button onClick={() => void detailQuery.refetch()}>다시 시도</Button>
        }
      />
    ) : (
      <LoadingState title="예약 내용을 확인하고 있어요" />
    );
  }

  return (
    <ReservationReviewScreen
      snapshot={snapshot}
      detail={detail}
      imageUrl={resolveImageUrl(detail.images[0]?.imageUrl ?? null)}
      availability={availability ?? null}
      availabilityLoading={availabilityQuery.isFetching}
      onRetryAvailability={() => void availabilityQuery.refetch()}
      coupons={couponsQuery.data?.coupons ?? []}
      couponsLoading={couponsQuery.isFetching}
      couponsError={couponsQuery.isError}
      onRetryCoupons={() => void couponsQuery.refetch()}
      busy={busy}
      error={error}
      canEdit={!blocked && (snapshot.phase === "quoted" || needsNewQuote)}
      needsNewQuote={needsNewQuote}
      blocked={blocked}
      onSave={save}
      onCheckout={() => void checkout()}
      onExit={exit}
      onRefresh={() => void save(reviewDraftFromSnapshot(snapshot))}
    />
  );
}
