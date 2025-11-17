import { ApiResponse, CursorPageInfo } from "./api";
import { ReservationStatus, PaymentStatus } from "./enums";
import { AddressInfo, HostInfo } from "./accommodation";

// 예약 생성
export interface CreateReservationRequest {
  accommodation_id: number;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  guest_count: number;
  message?: string;
}

export interface ReservationReady {
  reservation_uid: string;
  order_name: string;
  amount: number;
  customer_email: string;
  customer_name: string;
}

export type CreateReservationResponse = ApiResponse<ReservationReady>;

// 예약 취소
export interface CancelReservationRequest {
  cancel_reason: string;
  cancel_amount: number;
}

export type CancelReservationResponse = ApiResponse<null>;

// 게스트 예약 목록
export interface MyReservationInfo {
  reservation_id: number;
  reservation_uid: string;
  accommodation_name: string;
  accommodation_thumbnail_url: string | null;
  accommodation_location: string;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface MyReservationInfos {
  reservations: MyReservationInfo[];
  page_info: CursorPageInfo;
}

export type GetMyReservationsResponse = ApiResponse<MyReservationInfos>;

// 게스트 예약 상세
export interface AccommodationAddressInfo {
  country: string;
  city: string;
  district: string;
  street: string;
  detail: string;
  postal_code: string;
  full_address: string;
  latitude: number;
  longitude: number;
}

export interface VirtualAccountInfo {
  account_number: string;
  bank_code: string;
  customer_name: string;
  due_date: string;
}

export interface PaymentInfo {
  order_id: string;
  payment_key: string;
  method: string;
  total_amount: number;
  balance_amount?: number | null;
  status: PaymentStatus;
  requested_at: string;
  approved_at: string | null;
  cancels: CancelInfo[];
  virtual_account?: VirtualAccountInfo | null;
}

export interface CancelInfo {
  cancel_amount: number;
  cancel_reason: string;
  canceled_at: string;
}

export interface ReservationDetailInfo {
  reservation_uid: string;
  reservation_code: string;
  status: ReservationStatus;
  created_at: string;
  guest_count: number;
  message: string | null;
  accommodation_id: number;
  accommodation_name: string;
  accommodation_thumbnail_url: string | null;
  accommodation_address: AccommodationAddressInfo;
  accommodation_host: HostInfo;
  check_in_date_time: string;
  check_out_date_time: string;
  check_in_time: string; // HH:mm
  check_out_time: string; // HH:mm
  payment_info: PaymentInfo | null;
  can_write_review: boolean;
}

export type GetReservationDetailResponse = ApiResponse<ReservationDetailInfo>;

// 호스트 예약 목록
export interface HostReservationInfo {
  reservation_uid: string;
  status: ReservationStatus;
  guest_info: HostInfo;
  guest_count: number;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  created_at: string;
  accommodation_id: number;
  accommodation_name: string;
  thumbnail_url: string | null;
  reservation_code: string | null;
  total_price: number | null;
}

export interface HostReservationInfos {
  reservations: HostReservationInfo[];
  page_info: CursorPageInfo;
}

export type GetHostReservationsResponse = ApiResponse<HostReservationInfos>;

// 호스트 예약 상세
export interface HostDetailInfo {
  reservation_uid: string;
  reservation_code: string;
  status: ReservationStatus;
  created_at: string;
  guest_count: number;
  check_in_date_time: string;
  check_out_date_time: string;
  accommodation_id: number;
  accommodation_name: string;
  accommodation_thumbnail_url: string | null;
  accommodation_address: string;
  guest_info: HostInfo;
  payment_info: PaymentInfo | null;
}

export type GetHostReservationDetailResponse = ApiResponse<HostDetailInfo>;



