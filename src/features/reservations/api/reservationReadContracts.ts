import type { ReservationPaymentStatus } from "../model/reservationRead";

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

export interface ReservationPaymentWire {
  readonly method?: string | null;
  readonly total_amount: number;
  readonly status: ReservationPaymentStatus;
  readonly approved_at?: string | null;
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
  readonly time_zone_id: unknown;
  readonly status: unknown;
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
  readonly time_zone_id: unknown;
  readonly status: unknown;
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
  readonly status: unknown;
  readonly created_at: string;
  readonly guest_count: number;
  readonly check_in_date_time: string;
  readonly check_out_date_time: string;
  readonly time_zone_id: unknown;
  readonly request_message: unknown;
  readonly accommodation: ReservationAccommodationWire;
  readonly address: ReservationAddressWire;
}

export interface GuestReservationDetailWire extends ReservationDetailWireBase {
  readonly payment: ReservationPaymentWire | null;
  readonly payment_allowed: unknown;
  readonly hold_expires_at: unknown;
  readonly server_time: unknown;
  readonly check_in_time: string;
  readonly check_out_time: string;
  readonly can_write_review: unknown;
  readonly coordinate: ReservationCoordinateWire;
  readonly host: ReservationMemberWire;
}

export interface HostReservationDetailWire extends ReservationDetailWireBase {
  readonly guest: ReservationMemberWire;
  readonly payment: { readonly total_amount: number } | null;
}
