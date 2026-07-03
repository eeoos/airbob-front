import { client } from "./client";
import { unwrapApiResponse } from "./response";
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
    const response = await client.post<ApiResponse<ReservationReady>>("/reservations", request);
    return unwrapApiResponse(response.data);
  },

  // 예약 취소 (POST 메서드 사용)
  cancel: async (
    reservationUid: string,
    request: CancelReservationRequest
  ): Promise<void> => {
    const response = await client.post<ApiResponse<null>>(
      `/reservations/${reservationUid}`,
      request
    );
    unwrapApiResponse(response.data, { allowNull: true });
  },

  // 게스트 예약 목록 조회
  getMyReservations: async (params?: {
    size?: number;
    cursor?: string;
    filterType?: ReservationFilterType;
  }): Promise<GuestReservationInfos> => {
    const response = await client.get<ApiResponse<GuestReservationInfos>>(
      "/profile/guest/reservations",
      { params }
    );
    return unwrapApiResponse(response.data);
  },

  // 게스트 예약 상세 조회
  getMyReservationDetail: async (reservationUid: string): Promise<GuestReservationDetail> => {
    const response = await client.get<ApiResponse<GuestReservationDetail>>(
      `/profile/guest/reservations/${reservationUid}`
    );
    return unwrapApiResponse(response.data);
  },

  // 호스트 예약 목록 조회
  getHostReservations: async (params?: {
    size?: number;
    cursor?: string;
    filterType?: ReservationFilterType;
  }): Promise<HostReservationInfos> => {
    const response = await client.get<ApiResponse<HostReservationInfos>>(
      "/profile/host/reservations",
      { params }
    );
    return unwrapApiResponse(response.data);
  },

  // 호스트 예약 상세 조회
  getHostReservationDetail: async (
    reservationUid: string
  ): Promise<HostReservationDetail> => {
    const response = await client.get<ApiResponse<HostReservationDetail>>(
      `/profile/host/reservations/${reservationUid}`
    );
    return unwrapApiResponse(response.data);
  },
};
