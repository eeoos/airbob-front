import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AccommodationDetailQueryOptions,
  useAccommodationDetailReadQuery,
} from "../../features/accommodations/detail/public";
import { useStrictModeSafeDisposable } from "../../shared/lib/useStrictModeSafeDisposable";
import {
  createPaymentRequestWorkflow,
  type CheckoutData,
  type PaymentGatewayPort,
  type PaymentRequestRouteLease,
  type PaymentRequestSessionPort,
} from "../../workflows/booking-payment/checkout";
import {
  ReservationConfirmScreen,
  type ReservationConfirmPaymentStatus,
  type ReservationConfirmScreenState,
} from "./ReservationConfirmScreen";
import { toReservationConfirmCheckoutView } from "./reservationConfirmViewModel";

export interface ReservationConfirmCustomer {
  readonly email: string;
  readonly name: string;
}

export interface ReservationConfirmControllerProps {
  readonly checkout: CheckoutData;
  readonly customer: ReservationConfirmCustomer;
  readonly failUrl: string;
  readonly gateway: PaymentGatewayPort;
  readonly resolveImageUrl: (path: string | null) => string;
  readonly routeLease: PaymentRequestRouteLease;
  readonly scope: AccommodationDetailQueryOptions["scope"];
  readonly session: PaymentRequestSessionPort;
  readonly successUrl: string;
}

export function ReservationConfirmController({
  checkout,
  customer,
  failUrl,
  gateway,
  resolveImageUrl,
  routeLease,
  scope,
  session,
  successUrl,
}: ReservationConfirmControllerProps) {
  const detailQuery = useAccommodationDetailReadQuery({
    accommodationId: checkout.accommodationId,
    scope,
  });
  const [paymentStatus, setPaymentStatus] =
    useState<ReservationConfirmPaymentStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeRequestRef = useRef<Promise<unknown> | null>(null);
  const workflow = useMemo(
    () =>
      createPaymentRequestWorkflow({
        gateway,
        session: {
          captureAuthenticatedSession: session.captureAuthenticatedSession,
          isCurrentSession: session.isCurrentSession,
        },
      }),
    [
      gateway,
      session.captureAuthenticatedSession,
      session.isCurrentSession,
    ],
  );
  useStrictModeSafeDisposable(workflow);

  useEffect(() => {
    let active = true;
    setPaymentStatus("loading");
    setErrorMessage(null);

    void workflow.prepare({ routeLease }).then((result) => {
      if (!active || !routeLease.isCurrent()) return;

      switch (result.status) {
        case "ready":
          setPaymentStatus("ready");
          return;
        case "retryable-error":
          setPaymentStatus("ready");
          if (!result.error.silent) setErrorMessage(result.error.message);
          return;
        case "terminal-failure":
          setErrorMessage(result.error.message);
          return;
        case "invalid":
          setErrorMessage("결제 정보가 올바르지 않습니다.");
          return;
        case "cancelled":
        case "requested":
        case "stale":
        case "locked":
          return;
      }
    });

    return () => {
      active = false;
    };
  }, [routeLease, workflow]);

  const confirmPayment = useCallback(() => {
    if (activeRequestRef.current || paymentStatus !== "ready") return;

    setPaymentStatus("processing");
    setErrorMessage(null);
    const pending = workflow.request({
      amount: checkout.amount,
      customerEmail: customer.email,
      customerName: customer.name,
      failUrl,
      orderId: checkout.reservationUid,
      orderName: checkout.orderName,
      reservationUid: checkout.reservationUid,
      routeLease,
      successUrl,
    });
    activeRequestRef.current = pending;

    void pending
      .then((result) => {
        if (!routeLease.isCurrent()) return;
        switch (result.status) {
          case "requested":
            return;
          case "cancelled":
            setPaymentStatus("ready");
            if (!result.error.silent) setErrorMessage(result.error.message);
            return;
          case "retryable-error":
            setPaymentStatus("ready");
            if (!result.error.silent) setErrorMessage(result.error.message);
            return;
          case "terminal-failure":
            setPaymentStatus("loading");
            setErrorMessage(result.error.message);
            return;
          case "invalid":
            setPaymentStatus("loading");
            setErrorMessage("결제 정보가 올바르지 않습니다.");
            return;
          case "ready":
            setPaymentStatus("ready");
            return;
          case "stale":
          case "locked":
            return;
        }
      })
      .finally(() => {
        if (activeRequestRef.current === pending) {
          activeRequestRef.current = null;
        }
      });
  }, [
    checkout,
    customer.email,
    customer.name,
    failUrl,
    paymentStatus,
    routeLease,
    successUrl,
    workflow,
  ]);

  const state = useMemo<ReservationConfirmScreenState>(() => {
    if (detailQuery.isLoading) return { status: "loading" };
    const accommodation = detailQuery.data;
    if (detailQuery.isError || !accommodation) {
      return {
        status: "error",
        message: "숙소 정보를 불러올 수 없습니다.",
      };
    }

    return {
      status: "ready",
      accommodation: {
        averageRating: accommodation.reviewSummary.averageRating,
        name: accommodation.name,
        nightlyPrice: accommodation.basePrice,
        reviewCount: accommodation.reviewSummary.totalCount,
        thumbnailUrl: accommodation.images[0]
          ? resolveImageUrl(accommodation.images[0].imageUrl)
          : null,
      },
      checkout: toReservationConfirmCheckoutView(
        checkout,
        accommodation.basePrice,
      ),
    };
  }, [checkout, detailQuery.data, detailQuery.isError, detailQuery.isLoading, resolveImageUrl]);

  return (
    <ReservationConfirmScreen
      errorMessage={errorMessage}
      onClearError={() => setErrorMessage(null)}
      onConfirmPayment={confirmPayment}
      paymentStatus={paymentStatus}
      state={state}
    />
  );
}
