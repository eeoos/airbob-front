export interface PaymentConfirmationWireRequest {
  readonly payment_key: string;
  readonly order_id: string;
  readonly amount: number;
}

export interface PaymentRecordWire {
  readonly order_id: unknown;
  readonly payment_key?: unknown;
  readonly total_amount: unknown;
  readonly status: unknown;
}

export interface CheckoutOwnershipAccommodationWire {
  readonly id: unknown;
}

export interface CheckoutOwnershipWire {
  readonly reservation_uid: unknown;
  readonly check_in_date_time: unknown;
  readonly check_out_date_time: unknown;
  readonly guest_count: unknown;
  readonly accommodation: unknown;
  readonly payment: unknown;
}
