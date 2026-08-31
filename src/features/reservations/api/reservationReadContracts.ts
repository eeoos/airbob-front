import type {
  ReservationPaymentStatus,
  ReservationStatus,
} from "../model/reservationRead";

export interface ReservationAccommodationWire {
  readonly id: number;
  readonly name: string;
  readonly thumbnail_url: string | null;
}

export interface ReservationMemberWire {
  readonly id: number;
  readonly nickname: string;
  readonly thumbnail_image_url: string | null;
}

export interface ReservationAddressWire {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
  readonly street: string;
  readonly detail: string | null;
  readonly postal_code: string;
}

interface ReservationCoordinateWire {
  readonly latitude: number | null;
  readonly longitude: number | null;
}

interface ReservationPaymentCancelWire {
  readonly cancel_amount: number;
  readonly cancel_reason: string;
  readonly canceled_at: string;
}

interface ReservationVirtualAccountWire {
  readonly account_number: string;
  readonly bank_code: string;
  readonly customer_name: string;
  readonly due_date: string;
}

export interface ReservationPaymentWire {
  readonly order_id: string;
  readonly payment_key?: string | null;
  readonly method?: string | null;
  readonly total_amount: number;
  readonly balance_amount?: number | null;
  readonly status: ReservationPaymentStatus;
  readonly requested_at: string;
  readonly approved_at?: string | null;
  readonly cancels?: readonly ReservationPaymentCancelWire[];
  readonly virtual_account?: ReservationVirtualAccountWire | null;
}

export interface ReservationPageInfoWire {
  readonly has_next: boolean;
  readonly next_cursor: string | null;
  readonly current_size: number;
}

export interface GuestReservationListItemWire {
  readonly reservation_id: number;
  readonly reservation_uid: string;
  readonly check_in_date: string;
  readonly check_out_date: string;
  readonly created_at: string;
  readonly accommodation: ReservationAccommodationWire;
}

export interface GuestReservationPageWire {
  readonly reservations: readonly GuestReservationListItemWire[];
  readonly page_info: ReservationPageInfoWire;
}

export interface HostReservationListItemWire {
  readonly reservation_uid: string;
  readonly reservation_code: string;
  readonly total_price: number;
  readonly currency: string;
  readonly guest_count: number;
  readonly check_in_date: string;
  readonly check_out_date: string;
  readonly status: ReservationStatus;
  readonly created_at: string;
  readonly guest: ReservationMemberWire;
  readonly accommodation: ReservationAccommodationWire;
}

export interface HostReservationPageWire {
  readonly reservations: readonly HostReservationListItemWire[];
  readonly page_info: ReservationPageInfoWire;
}

interface ReservationDetailWireBase {
  readonly reservation_uid: string;
  readonly reservation_code: string;
  readonly status: ReservationStatus;
  readonly created_at: string;
  readonly guest_count: number;
  readonly check_in_date_time: string;
  readonly check_out_date_time: string;
  readonly accommodation: ReservationAccommodationWire;
  readonly address: ReservationAddressWire;
  readonly payment: ReservationPaymentWire | null;
}

export interface GuestReservationDetailWire extends ReservationDetailWireBase {
  readonly check_in_time: string;
  readonly check_out_time: string;
  readonly can_write_review: boolean;
  readonly coordinate: ReservationCoordinateWire;
  readonly host: ReservationMemberWire;
}

export interface HostReservationDetailWire extends ReservationDetailWireBase {
  readonly guest: ReservationMemberWire;
}
