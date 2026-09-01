import type { BookingPaymentRuntimeLease } from "./types";

type BookingPaymentCurrency = "KRW";

export interface BookingPaymentCallbackCredentialData {
  readonly flowId: string;
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentAttemptId: string;
  readonly paymentKey: string;
  readonly amount: number;
  readonly currency: BookingPaymentCurrency;
}

export interface BookingPaymentCallbackCredentialEnvelope {
  readonly purpose: "booking-payment-callback-credential";
  readonly version: 2;
  readonly privacyClass: "sensitive";
  readonly containsPii: false;
  readonly owner: string;
  readonly createdAt: number;
  readonly hardExpiresAt: number;
  readonly data: BookingPaymentCallbackCredentialData;
}

type BookingPaymentOperationStatus =
  "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "REQUIRES_REVIEW";

type BookingPaymentOperationNextAction =
  "POLL" | "START_NEW_CHECKOUT" | "CONTACT_SUPPORT" | "NONE";

type BookingPaymentOperationUserFailureCode =
  "PAYMENT_DECLINED" | "PAYMENT_REVIEW_REQUIRED";

export interface BookingPaymentOperationIdentity {
  readonly operationId: string;
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentAttemptId: string;
  readonly amount: number;
  readonly currency: BookingPaymentCurrency;
}

export interface BookingPaymentOperationObservation {
  readonly status: BookingPaymentOperationStatus;
  readonly updatedAt: string;
  readonly nextAction: BookingPaymentOperationNextAction;
  readonly retryAfterSeconds: number | null;
  readonly userFailureCode: BookingPaymentOperationUserFailureCode | null;
  readonly serverTime: string;
}

export interface BookingPaymentOperationReceiptData {
  readonly flowId: string;
  readonly operation: BookingPaymentOperationIdentity;
  readonly observation: BookingPaymentOperationObservation | null;
}

export interface BookingPaymentOperationReceiptEnvelope {
  readonly purpose: "booking-payment-operation-receipt";
  readonly version: 2;
  readonly privacyClass: "personal";
  readonly containsPii: false;
  readonly owner: string;
  readonly createdAt: number;
  readonly hardExpiresAt: number;
  readonly lease: BookingPaymentRuntimeLease;
  readonly data: BookingPaymentOperationReceiptData;
}

export type BookingPaymentObservationReplacementDecision =
  "replace" | "unchanged" | "reject";
