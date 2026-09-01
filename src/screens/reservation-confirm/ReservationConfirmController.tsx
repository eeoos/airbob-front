import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AccommodationDetailQueryOptions,
  useAccommodationDetailReadQuery,
} from "../../features/accommodations/detail/public";
import type {
  BookingTransactionHandle,
  BookingTransactionRouteLease,
  BookingTransactionSnapshot,
  BookingTransactionWorkflow,
} from "../../workflows/booking-payment/transaction/booking";
import {
  ReservationConfirmScreen,
  type ReservationConfirmPaymentStatus,
  type ReservationConfirmScreenState,
} from "./ReservationConfirmScreen";
import { toReservationConfirmCheckoutView } from "./reservationConfirmViewModel";

interface ReservationConfirmCustomer {
  readonly email: string;
  readonly name: string;
}

interface ActiveReservationRequest {
  readonly flowId: string;
  readonly pending: Promise<unknown>;
  readonly routeLease: BookingTransactionRouteLease;
  readonly workflow: BookingTransactionWorkflow;
}

export interface ReservationConfirmControllerProps {
  readonly customer: ReservationConfirmCustomer;
  readonly failUrl: string;
  readonly handle: BookingTransactionHandle;
  readonly onReleased: (
    handle: BookingTransactionHandle,
    snapshot: BookingTransactionSnapshot,
    routeLease: BookingTransactionRouteLease,
  ) => Promise<boolean>;
  readonly onReservationStatusDrift: (
    handle: BookingTransactionHandle,
    snapshot: BookingTransactionSnapshot,
    routeLease: BookingTransactionRouteLease,
  ) => Promise<boolean>;
  readonly resolveImageUrl: (path: string | null) => string;
  readonly routeLease: BookingTransactionRouteLease;
  readonly scope: AccommodationDetailQueryOptions["scope"];
  readonly snapshot: BookingTransactionSnapshot;
  readonly successUrl: string;
  readonly workflow: BookingTransactionWorkflow;
}

const requestFailureMessage = (code: string): string => {
  if (code === "R022") {
    return "결제 가능 시간이 부족합니다. 예약을 해제한 뒤 다시 예약해주세요.";
  }
  return "결제 준비 결과를 확인하지 못했습니다. 같은 결제 시도를 다시 사용합니다.";
};

export function ReservationConfirmController({
  customer,
  failUrl,
  handle,
  onReleased,
  onReservationStatusDrift,
  resolveImageUrl,
  routeLease,
  scope,
  snapshot: initialSnapshot,
  successUrl,
  workflow,
}: ReservationConfirmControllerProps) {
  const detailQuery = useAccommodationDetailReadQuery({
    accommodationId: initialSnapshot.accommodationId,
    scope,
  });
  const [snapshot, setSnapshot] =
    useState<BookingTransactionSnapshot>(initialSnapshot);
  const [paymentStatus, setPaymentStatus] =
    useState<ReservationConfirmPaymentStatus>("loading");
  const [isReleasing, setIsReleasing] = useState(false);
  const [hasReservationStatusDrift, setHasReservationStatusDrift] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeRequestRef = useRef<ActiveReservationRequest | null>(null);

  const hasActiveRequest = useCallback(() => {
    const activeRequest = activeRequestRef.current;
    return (
      activeRequest !== null &&
      activeRequest.flowId === handle.flowId &&
      activeRequest.routeLease === routeLease &&
      activeRequest.workflow === workflow
    );
  }, [handle.flowId, routeLease, workflow]);

  useEffect(() => {
    setIsReleasing(false);
  }, [handle.flowId, routeLease, workflow]);

  const finishRelease = useCallback(
    async (releasedSnapshot: BookingTransactionSnapshot) => {
      setIsReleasing(true);
      const completed = await onReleased(handle, releasedSnapshot, routeLease);
      if (!completed && routeLease.isCurrent()) {
        setIsReleasing(false);
        setErrorMessage("예약 내역을 갱신하지 못했습니다. 다시 확인해주세요.");
      }
    },
    [handle, onReleased, routeLease],
  );

  useEffect(() => {
    let active = true;
    setSnapshot(initialSnapshot);
    setErrorMessage(null);
    setHasReservationStatusDrift(false);
    setPaymentStatus("loading");

    if (initialSnapshot.phase === "hold-released") {
      void finishRelease(initialSnapshot);
      return () => {
        active = false;
      };
    }
    if (initialSnapshot.phase === "hold-release-requesting") {
      return () => {
        active = false;
      };
    }

    void workflow.prepareGateway({ handle, routeLease }).then((result) => {
      if (!active || !routeLease.isCurrent()) return;
      switch (result.status) {
        case "ready":
          setPaymentStatus("ready");
          return;
        case "gateway-error":
          if (result.error.kind === "terminal") {
            setPaymentStatus("loading");
          } else {
            setPaymentStatus("ready");
          }
          if (!result.error.silent) setErrorMessage(result.error.message);
          return;
        case "auth-required":
          setErrorMessage("다시 로그인한 뒤 결제를 계속해주세요.");
          return;
        case "missing":
        case "blocked":
          setErrorMessage("결제 정보를 안전하게 확인할 수 없습니다.");
          return;
        case "busy":
        case "stale":
        case "locked":
          return;
      }
    });

    return () => {
      active = false;
    };
  }, [finishRelease, handle, initialSnapshot, routeLease, workflow]);

  const confirmPayment = useCallback(() => {
    if (hasActiveRequest() || paymentStatus !== "ready") return;
    if (!snapshot.canPay) {
      setErrorMessage("현재 예약은 결제를 시작할 수 없습니다.");
      return;
    }

    setPaymentStatus("processing");
    setErrorMessage(null);
    const pending = workflow.pay({
      customer,
      failUrl,
      handle,
      routeLease,
      successUrl,
    });
    const activeRequest = {
      flowId: handle.flowId,
      pending,
      routeLease,
      workflow,
    };
    activeRequestRef.current = activeRequest;

    void pending
      .then(async (result) => {
        if (!routeLease.isCurrent()) return;
        switch (result.status) {
          case "gateway-requested":
            setSnapshot(result.snapshot);
            return;
          case "gateway-cancelled":
            setSnapshot(result.snapshot);
            setPaymentStatus("ready");
            setErrorMessage(
              "결제가 취소되었습니다. 같은 결제 시도로 다시 진행할 수 있습니다.",
            );
            return;
          case "gateway-error":
            setSnapshot(result.snapshot);
            setPaymentStatus(
              result.error.kind === "terminal" ? "loading" : "ready",
            );
            if (!result.error.silent) setErrorMessage(result.error.message);
            return;
          case "attempt-unavailable": {
            const loaded = workflow.load({ handle, routeLease });
            if (loaded.status === "ready") setSnapshot(loaded.snapshot);
            if (result.failure.code === "R023") {
              setHasReservationStatusDrift(true);
              setPaymentStatus("loading");
              const completed = await onReservationStatusDrift(
                handle,
                loaded.status === "ready" ? loaded.snapshot : snapshot,
                routeLease,
              );
              if (!completed && routeLease.isCurrent()) {
                setPaymentStatus("ready");
                setErrorMessage(
                  "예약 상태를 갱신하지 못했습니다. 예약 내역에서 확인해주세요.",
                );
              }
              return;
            }
            setPaymentStatus(
              result.failure.code === "R022" ? "loading" : "ready",
            );
            setErrorMessage(requestFailureMessage(result.failure.code));
            return;
          }
          case "retryable-error": {
            const loaded = workflow.load({ handle, routeLease });
            if (loaded.status === "ready") setSnapshot(loaded.snapshot);
            setPaymentStatus("ready");
            setErrorMessage(requestFailureMessage(result.failure.code));
            return;
          }
          case "invalid-payment-request":
            setPaymentStatus("loading");
            setErrorMessage("결제 요청 정보가 올바르지 않습니다.");
            return;
          case "not-payable":
            setPaymentStatus("loading");
            setErrorMessage("현재 예약은 결제를 시작할 수 없습니다.");
            return;
          case "auth-required":
            setPaymentStatus("loading");
            setErrorMessage("다시 로그인한 뒤 결제를 계속해주세요.");
            return;
          case "missing":
          case "blocked":
            setPaymentStatus("loading");
            setErrorMessage("결제 정보를 안전하게 확인할 수 없습니다.");
            return;
          case "busy":
            setPaymentStatus("ready");
            return;
          case "stale":
          case "locked":
            return;
        }
      })
      .finally(() => {
        if (activeRequestRef.current === activeRequest) {
          activeRequestRef.current = null;
        }
      });
  }, [
    customer,
    failUrl,
    handle,
    hasActiveRequest,
    onReservationStatusDrift,
    paymentStatus,
    routeLease,
    snapshot,
    successUrl,
    workflow,
  ]);

  const releaseHold = useCallback(() => {
    if (hasActiveRequest() || isReleasing) return;
    if (snapshot.phase === "hold-released") {
      void finishRelease(snapshot);
      return;
    }
    if (!snapshot.canReleaseHold) return;

    setIsReleasing(true);
    setErrorMessage(null);
    const pending = workflow.releaseHold({ handle, routeLease });
    const activeRequest = {
      flowId: handle.flowId,
      pending,
      routeLease,
      workflow,
    };
    activeRequestRef.current = activeRequest;
    void pending
      .then(async (result) => {
        if (!routeLease.isCurrent()) return;
        switch (result.status) {
          case "released":
            setSnapshot(result.snapshot);
            await finishRelease(result.snapshot);
            return;
          case "retryable-error":
            {
              const loaded = workflow.load({ handle, routeLease });
              if (loaded.status === "ready") setSnapshot(loaded.snapshot);
            }
            setIsReleasing(false);
            setErrorMessage(
              "예약 해제 결과를 확인하지 못했습니다. 같은 작업을 다시 시도해주세요.",
            );
            return;
          case "not-releasable": {
            const loaded = workflow.load({ handle, routeLease });
            const driftSnapshot =
              loaded.status === "ready" ? loaded.snapshot : snapshot;
            if (loaded.status === "ready") setSnapshot(loaded.snapshot);
            setHasReservationStatusDrift(true);
            setPaymentStatus("loading");
            const completed = await onReservationStatusDrift(
              handle,
              driftSnapshot,
              routeLease,
            );
            if (!completed && routeLease.isCurrent()) {
              setIsReleasing(false);
              setErrorMessage(
                "예약 상태를 갱신하지 못했습니다. 예약 내역에서 확인해주세요.",
              );
            }
            return;
          }
          case "auth-required":
            setIsReleasing(false);
            setErrorMessage("다시 로그인한 뒤 예약을 확인해주세요.");
            return;
          case "missing":
          case "blocked":
            setIsReleasing(false);
            setErrorMessage("예약 정보를 안전하게 확인할 수 없습니다.");
            return;
          case "busy":
            setIsReleasing(false);
            return;
          case "stale":
          case "locked":
            return;
        }
      })
      .finally(() => {
        if (activeRequestRef.current === activeRequest) {
          activeRequestRef.current = null;
        }
      });
  }, [
    finishRelease,
    handle,
    hasActiveRequest,
    isReleasing,
    onReservationStatusDrift,
    routeLease,
    snapshot,
    workflow,
  ]);

  const state = useMemo<ReservationConfirmScreenState>(() => {
    if (detailQuery.isLoading) return { status: "loading" };
    const accommodation = detailQuery.data;
    if (detailQuery.isError || !accommodation) {
      return { status: "error", message: "숙소 정보를 불러올 수 없습니다." };
    }

    return {
      status: "ready",
      accommodation: {
        averageRating: accommodation.reviewSummary.averageRating,
        name: accommodation.name,
        nightlyPrice: snapshot.nightlyPrice,
        reviewCount: accommodation.reviewSummary.totalCount,
        thumbnailUrl: accommodation.images[0]
          ? resolveImageUrl(accommodation.images[0].imageUrl)
          : null,
      },
      checkout: toReservationConfirmCheckoutView(snapshot),
    };
  }, [
    detailQuery.data,
    detailQuery.isError,
    detailQuery.isLoading,
    resolveImageUrl,
    snapshot,
  ]);

  return (
    <ReservationConfirmScreen
      canReleaseHold={
        !hasReservationStatusDrift &&
        (snapshot.canReleaseHold || snapshot.phase === "hold-released")
      }
      errorMessage={errorMessage}
      isReleasing={isReleasing}
      onClearError={() => setErrorMessage(null)}
      onConfirmPayment={confirmPayment}
      onReleaseHold={releaseHold}
      paymentStatus={paymentStatus}
      state={state}
    />
  );
}
