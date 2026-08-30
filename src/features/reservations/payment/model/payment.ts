export const PAYMENT_STATUSES = [
  "READY",
  "IN_PROGRESS",
  "WAITING_FOR_DEPOSIT",
  "DONE",
  "CANCELED",
  "PARTIAL_CANCELED",
  "ABORTED",
  "EXPIRED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface PaymentRecord {
  readonly orderId: string;
  readonly paymentKey: string | null;
  readonly totalAmount: number;
  readonly status: PaymentStatus;
}

export interface PaymentConfirmation {
  readonly paymentKey: string;
  readonly orderId: string;
  readonly amount: number;
}

export interface PaymentCommandOptions {
  readonly signal?: AbortSignal;
}
