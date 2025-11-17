import { client } from "./client";
import {
  CreateWishlistRequest,
  CreateWishlistResponse,
  UpdateWishlistRequest,
  UpdateWishlistResponse,
  DeleteWishlistResponse,
  GetWishlistsResponse,
  CreateWishlistAccommodationRequest,
  CreateWishlistAccommodationResponse,
  UpdateWishlistAccommodationRequest,
  UpdateWishlistAccommodationResponse,
  DeleteWishlistAccommodationResponse,
  GetWishlistAccommodationsResponse,
} from "../types/wishlist";
import { ApiResponse } from "../types/api";

export const wishlistApi = {
  // 위시리스트 생성
  create: async (request: CreateWishlistRequest): Promise<CreateWishlistResponse> => {
    const response = await client.post<CreateWishlistResponse>("/members/wishlists", request);
    return response.data;
  },

  // 위시리스트 수정
  update: async (
    wishlistId: number,
    request: UpdateWishlistRequest
  ): Promise<UpdateWishlistResponse> => {
    const response = await client.patch<UpdateWishlistResponse>(
      `/members/wishlists/${wishlistId}`,
      request
    );
    return response.data;
  },

  // 위시리스트 삭제
  delete: async (wishlistId: number): Promise<DeleteWishlistResponse> => {
    const response = await client.delete<DeleteWishlistResponse>(`/members/wishlists/${wishlistId}`);
    return response.data;
  },

  // 위시리스트 목록 조회
  getWishlists: async (params?: {
    size?: number;
    cursor?: string;
    accommodationId?: number;
  }): Promise<GetWishlistsResponse> => {
    const response = await client.get<GetWishlistsResponse>("/members/wishlists", { params });
    return response.data;
  },

  // 위시리스트에 숙소 추가
  addAccommodation: async (
    wishlistId: number,
    request: CreateWishlistAccommodationRequest
  ): Promise<CreateWishlistAccommodationResponse> => {
    const response = await client.post<CreateWishlistAccommodationResponse>(
      `/members/wishlists/accommodations/${wishlistId}`,
      request
    );
    return response.data;
  },

  // 위시리스트 숙소 메모 수정
  updateAccommodationMemo: async (
    wishlistAccommodationId: number,
    request: UpdateWishlistAccommodationRequest
  ): Promise<UpdateWishlistAccommodationResponse> => {
    const response = await client.patch<UpdateWishlistAccommodationResponse>(
      `/members/wishlists/${wishlistAccommodationId}`,
      request
    );
    return response.data;
  },

  // 위시리스트에서 숙소 삭제
  removeAccommodation: async (
    wishlistAccommodationId: number
  ): Promise<DeleteWishlistAccommodationResponse> => {
    const response = await client.delete<DeleteWishlistAccommodationResponse>(
      `/members/wishlists/accommodations/${wishlistAccommodationId}`
    );
    return response.data;
  },

  // 위시리스트 상세 조회
  getWishlistAccommodations: async (
    wishlistId: number,
    params?: {
      size?: number;
      cursor?: string;
    }
  ): Promise<GetWishlistAccommodationsResponse> => {
    const response = await client.get<GetWishlistAccommodationsResponse>(
      `/members/wishlists/accommodations/${wishlistId}`,
      { params }
    );
    return response.data;
  },
};


