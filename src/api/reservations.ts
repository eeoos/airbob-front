import { client } from "./client";
import {
  CreateReservationRequest,
  CreateReservationResponse,
  CancelReservationRequest,
  CancelReservationResponse,
  GetMyReservationsResponse,
  GetReservationDetailResponse,
  GetHostReservationsResponse,
  GetHostReservationDetailResponse,
} from "../types/reservation";
import { ApiResponse } from "../types/api";

export const reservationApi = {
  // 예약 생성
  create: async (request: CreateReservationRequest): Promise<CreateReservationResponse> => {
    const response = await client.post<CreateReservationResponse>("/reservations", request);
    return response.data;
  },

  // 예약 취소
  cancel: async (
    reservationUid: string,
    request: CancelReservationRequest
  ): Promise<CancelReservationResponse> => {
    const response = await client.delete<CancelReservationResponse>(
      `/reservations/${reservationUid}`,
      { data: request }
    );
    return response.data;
  },

  // 게스트 예약 목록 조회
  getMyReservations: async (params?: {
    size?: number;
    cursor?: string;
    filterType?: "UPCOMING" | "PAST" | "CANCELLED";
  }): Promise<GetMyReservationsResponse> => {
    const response = await client.get<GetMyReservationsResponse>(
      "/profile/guest/reservations",
      { params }
    );
    return response.data;
  },

  // 게스트 예약 상세 조회
  getMyReservationDetail: async (reservationUid: string): Promise<GetReservationDetailResponse> => {
    const response = await client.get<GetReservationDetailResponse>(
      `/profile/guest/reservations/${reservationUid}`
    );
    return response.data;
  },

  // 호스트 예약 목록 조회
  getHostReservations: async (params?: {
    size?: number;
    cursor?: string;
    filterType?: "UPCOMING" | "PAST" | "CANCELLED";
  }): Promise<GetHostReservationsResponse> => {
    const response = await client.get<GetHostReservationsResponse>(
      "/profile/host/reservations",
      { params }
    );
    return response.data;
  },

  // 호스트 예약 상세 조회
  getHostReservationDetail: async (
    reservationUid: string
  ): Promise<GetHostReservationDetailResponse> => {
    const response = await client.get<GetHostReservationDetailResponse>(
      `/profile/host/reservations/${reservationUid}`
    );
    return response.data;
  },
};

