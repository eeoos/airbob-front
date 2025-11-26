import { client } from "./client";
import {
  CreateWishlistRequest,
  CreateWishlistData,
  UpdateWishlistRequest,
  UpdateWishlistData,
  WishlistInfos,
  CreateWishlistAccommodationRequest,
  CreateWishlistAccommodationData,
  UpdateWishlistAccommodationRequest,
  UpdateWishlistAccommodationData,
  WishlistAccommodationInfos,
} from "../types/wishlist";
import { ApiResponse } from "../types/api";

export const wishlistApi = {
  // 위시리스트 생성
  create: async (request: CreateWishlistRequest): Promise<CreateWishlistData> => {
    const response = await client.post<ApiResponse<CreateWishlistData>>(
      "/members/wishlists",
      request
    );
    return response.data.data!;
  },

  // 위시리스트 수정
  update: async (
    wishlistId: number,
    request: UpdateWishlistRequest
  ): Promise<UpdateWishlistData> => {
    const response = await client.patch<ApiResponse<UpdateWishlistData>>(
      `/members/wishlists/${wishlistId}`,
      request
    );
    return response.data.data!;
  },

  // 위시리스트 삭제
  delete: async (wishlistId: number): Promise<void> => {
    await client.delete<ApiResponse<null>>(`/members/wishlists/${wishlistId}`);
  },

  // 위시리스트 목록 조회
  getWishlists: async (params?: {
    size?: number;
    cursor?: string;
    accommodationId?: number;
  }): Promise<WishlistInfos> => {
    const response = await client.get<ApiResponse<WishlistInfos>>(
      "/members/wishlists",
      { params }
    );
    return response.data.data!;
  },

  // 위시리스트에 숙소 추가
  addAccommodation: async (
    wishlistId: number,
    request: CreateWishlistAccommodationRequest
  ): Promise<CreateWishlistAccommodationData> => {
    const response = await client.post<ApiResponse<CreateWishlistAccommodationData>>(
      `/members/wishlists/accommodations/${wishlistId}`,
      request
    );
    return response.data.data!;
  },

  // 위시리스트 숙소 메모 수정
  updateAccommodationMemo: async (
    wishlistAccommodationId: number,
    request: UpdateWishlistAccommodationRequest
  ): Promise<UpdateWishlistAccommodationData> => {
    const response = await client.patch<ApiResponse<UpdateWishlistAccommodationData>>(
      `/members/wishlists/accommodations/${wishlistAccommodationId}`,
      request
    );
    return response.data.data!;
  },

  // 위시리스트에서 숙소 삭제
  removeAccommodation: async (wishlistAccommodationId: number): Promise<void> => {
    await client.delete<ApiResponse<null>>(
      `/members/wishlists/accommodations/${wishlistAccommodationId}`
    );
  },

  // 위시리스트 상세 조회 (숙소 목록)
  getWishlistAccommodations: async (
    wishlistId: number,
    params?: {
      size?: number;
      cursor?: string;
    }
  ): Promise<WishlistAccommodationInfos> => {
    const response = await client.get<ApiResponse<WishlistAccommodationInfos>>(
      `/members/wishlists/accommodations/${wishlistId}`,
      { params }
    );
    return response.data.data!;
  },
};
