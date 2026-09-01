export interface ReservationQuoteWireRequest {
  readonly accommodation_id: number;
  readonly check_in_date: string;
  readonly check_out_date: string;
  readonly guest_count: number;
  readonly coupon_id?: number;
}

export interface ReservationQuoteWire {
  readonly quote_uid: unknown;
  readonly accommodation_id: unknown;
  readonly order_name: unknown;
  readonly check_in: unknown;
  readonly check_out: unknown;
  readonly guest_count: unknown;
  readonly nightly_price: unknown;
  readonly nights: unknown;
  readonly subtotal: unknown;
  readonly discount_amount: unknown;
  readonly amount: unknown;
  readonly currency: unknown;
  readonly payment_required: unknown;
  readonly inventory_held: unknown;
  readonly quote_expires_at: unknown;
  readonly server_time: unknown;
}

export interface ReservationCheckoutWireRequest {
  readonly quote_uid: string;
  readonly request_message: null;
}

export interface ReservationReadyWire {
  readonly reservation_uid: unknown;
  readonly order_name: unknown;
  readonly check_in: unknown;
  readonly check_out: unknown;
  readonly guest_count: unknown;
  readonly subtotal: unknown;
  readonly discount_amount: unknown;
  readonly amount: unknown;
  readonly currency: unknown;
  readonly status: unknown;
  readonly payment_required: unknown;
  readonly payment_allowed: unknown;
  readonly hold_expires_at: unknown;
  readonly server_time: unknown;
  readonly customer_email: unknown;
  readonly customer_name: unknown;
}
