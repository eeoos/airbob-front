import { client } from "./client";
import { requestApi, requestApiNullable } from "./request";
import {
  CreateReservationRequest,
  CancelReservationRequest,
  ReservationReady,
  GuestReservationInfos,
  GuestReservationDetail,
  HostReservationInfos,
  HostReservationDetail,
  ReservationFilterType,
} from "../types/reservation";
import { ApiResponse } from "../types/api";

export const reservationApi = {
  // 예약 생성 (결제 대기 상태)
  create: async (request: CreateReservationRequest): Promise<ReservationReady> => {
    return requestApi(() =>
      client.post<ApiResponse<ReservationReady>>("/reservations", request)
    );
  },

  // 예약 취소 (POST 메서드 사용)
  cancel: async (
    reservationUid: string,
    request: CancelReservationRequest
  ): Promise<void> => {
    await requestApiNullable(() =>
      client.post<ApiResponse<null>>(`/reservations/${reservationUid}`, request)
    );
  },

  // 게스트 예약 목록 조회
  getMyReservations: async (params?: {
    size?: number;
    cursor?: string;
    filterType?: ReservationFilterType;
  }): Promise<GuestReservationInfos> => {
    return requestApi(() =>
      client.get<ApiResponse<GuestReservationInfos>>("/profile/guest/reservations", { params })
    );
  },

  // 게스트 예약 상세 조회
  getMyReservationDetail: async (reservationUid: string): Promise<GuestReservationDetail> => {
    return requestApi(() =>
      client.get<ApiResponse<GuestReservationDetail>>(
        `/profile/guest/reservations/${reservationUid}`
      )
    );
  },

  // 호스트 예약 목록 조회
  getHostReservations: async (params?: {
    size?: number;
    cursor?: string;
    filterType?: ReservationFilterType;
  }): Promise<HostReservationInfos> => {
    return requestApi(() =>
      client.get<ApiResponse<HostReservationInfos>>("/profile/host/reservations", { params })
    );
  },

  // 호스트 예약 상세 조회
  getHostReservationDetail: async (
    reservationUid: string
  ): Promise<HostReservationDetail> => {
    return requestApi(() =>
      client.get<ApiResponse<HostReservationDetail>>(
        `/profile/host/reservations/${reservationUid}`
      )
    );
  },
};
