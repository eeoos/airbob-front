export interface ReservationCreateWireRequest {
  readonly accommodation_id: number;
  readonly check_in_date: string;
  readonly check_out_date: string;
  readonly guest_count: number;
  readonly coupon_id?: number;
}

export interface ReservationReadyWire {
  readonly reservation_uid: string;
  readonly order_name: string;
  readonly amount: number;
  readonly customer_email: string;
  readonly customer_name: string;
}
