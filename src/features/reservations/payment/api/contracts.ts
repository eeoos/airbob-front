export interface PaymentAttemptWire {
  readonly payment_attempt_id: unknown;
  readonly order_id: unknown;
  readonly amount: unknown;
  readonly currency: unknown;
  readonly hold_expires_at: unknown;
  readonly remaining_seconds: unknown;
  readonly server_time: unknown;
}

export interface ReservationHoldReleaseWire {
  readonly reservation_uid: unknown;
  readonly status: unknown;
  readonly released_now: unknown;
  readonly server_time: unknown;
}

export interface PaymentOperationConfirmationWireRequest {
  readonly payment_key: string;
  readonly order_id: string;
  readonly amount: number;
  readonly payment_attempt_id: string;
}

export interface PaymentOperationAcceptedWire {
  readonly operation_id: unknown;
  readonly status: unknown;
  readonly status_url?: unknown;
}

export interface PaymentOperationDetailWire {
  readonly operation_id: unknown;
  readonly order_id: unknown;
  readonly status: unknown;
  readonly failure_code?: unknown;
  readonly updated_at: unknown;
  readonly next_action: unknown;
  readonly retry_after_seconds: unknown;
  readonly user_message?: unknown;
  readonly server_time: unknown;
  readonly user_failure_code: unknown;
}
