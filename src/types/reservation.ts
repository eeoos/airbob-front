import { ApiResponse, CursorPageInfo } from "./api";
import { ReservationStatus, PaymentStatus } from "./enums";
import {
  AddressInfo,
  Coordinate,
  MemberInfo,
  AccommodationBasicInfo,
} from "./accommodation";
import { PaymentInfo } from "./payment";

// 예약 생성 요청
export interface CreateReservationRequest {
  accommodationId: number;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  guestCount: number;
}

// 예약 생성 응답 (결제 대기 상태)
export interface ReservationReady {
  reservation_uid: string;
  order_name: string;
  amount: number;
  customer_email: string;
  customer_name: string;
}

export type CreateReservationResponse = ApiResponse<ReservationReady>;

// 예약 취소 요청
export interface CancelReservationRequest {
  cancel_reason: string;
  cancel_amount?: number | null;
}

export type CancelReservationResponse = ApiResponse<null>;

// 게스트 예약 목록
export interface GuestReservationInfo {
  reservation_id: number;
  reservation_uid: string;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  created_at: string;
  accommodation: AccommodationBasicInfo;
}

export interface GuestReservationInfos {
  reservations: GuestReservationInfo[];
  page_info: CursorPageInfo;
}

export type GetMyReservationsResponse = ApiResponse<GuestReservationInfos>;

// 게스트 예약 상세
export interface GuestReservationDetail {
  reservation_uid: string;
  reservation_code: string;
  status: ReservationStatus;
  created_at: string;
  guest_count: number;
  check_in_date_time: string;
  check_out_date_time: string;
  check_in_time: string; // HH:mm:ss
  check_out_time: string; // HH:mm:ss
  can_write_review: boolean;
  accommodation: AccommodationBasicInfo;
  address: AddressInfo;
  coordinate: Coordinate;
  host: MemberInfo;
  payment: PaymentInfo | null;
}

export type GetReservationDetailResponse = ApiResponse<GuestReservationDetail>;

// 호스트 예약 목록
export interface HostReservationInfo {
  reservation_uid: string;
  reservation_code: string;
  total_price: number;
  currency: string;
  guest_count: number;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  status: ReservationStatus;
  created_at: string;
  guest: MemberInfo;
  accommodation: AccommodationBasicInfo;
}

export interface HostReservationInfos {
  reservations: HostReservationInfo[];
  page_info: CursorPageInfo;
}

export type GetHostReservationsResponse = ApiResponse<HostReservationInfos>;

// 호스트 예약 상세
export interface HostReservationDetail {
  reservation_uid: string;
  reservation_code: string;
  status: ReservationStatus;
  created_at: string;
  guest_count: number;
  check_in_date_time: string;
  check_out_date_time: string;
  accommodation: AccommodationBasicInfo;
  address: AddressInfo;
  guest: MemberInfo;
  payment: PaymentInfo | null;
}

export type GetHostReservationDetailResponse = ApiResponse<HostReservationDetail>;

// 필터 타입
export type ReservationFilterType = "UPCOMING" | "COMPLETED" | "CANCELLED";

// Legacy 호환성을 위한 타입 aliases
export type MyReservationInfo = GuestReservationInfo;
export type MyReservationInfos = GuestReservationInfos;
export type ReservationDetailInfo = GuestReservationDetail;
export type HostDetailInfo = HostReservationDetail;
