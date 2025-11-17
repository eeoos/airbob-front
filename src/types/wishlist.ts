import { ApiResponse, CursorPageInfo } from "./api";
import { ReviewSummary } from "./accommodation";

// 위시리스트 생성
export interface CreateWishlistRequest {
  name: string;
}

export interface CreateWishlistData {
  id: number;
}

export type CreateWishlistResponse = ApiResponse<CreateWishlistData>;

// 위시리스트 수정
export interface UpdateWishlistRequest {
  name: string;
}

export interface UpdateWishlistData {
  id: number;
}

export type UpdateWishlistResponse = ApiResponse<UpdateWishlistData>;

// 위시리스트 삭제
export type DeleteWishlistResponse = ApiResponse<null>;

// 위시리스트 목록 조회
export interface WishlistInfo {
  id: number;
  name: string;
  created_at: string;
  wishlist_item_count: number;
  thumbnail_image_url: string | null;
  is_contained: boolean | null;
  wishlist_accommodation_id: number | null;
}

export interface WishlistInfos {
  wishlists: WishlistInfo[];
  page_info: CursorPageInfo;
}

export type GetWishlistsResponse = ApiResponse<WishlistInfos>;

// 위시리스트에 숙소 추가
export interface CreateWishlistAccommodationRequest {
  accommodation_id: number;
}

export interface CreateWishlistAccommodationData {
  id: number;
}

export type CreateWishlistAccommodationResponse = ApiResponse<CreateWishlistAccommodationData>;

// 위시리스트 숙소 메모 수정
export interface UpdateWishlistAccommodationRequest {
  memo: string;
}

export interface UpdateWishlistAccommodationData {
  id: number;
}

export type UpdateWishlistAccommodationResponse = ApiResponse<UpdateWishlistAccommodationData>;

// 위시리스트에서 숙소 삭제
export type DeleteWishlistAccommodationResponse = ApiResponse<null>;

// 위시리스트 상세 조회
export interface WishlistAccommodationInfo {
  wishlist_accommodation_id: number;
  memo: string;
  accommodation_id: number;
  accommodation_name: string;
  thumbnail_url: string | null;
  location_summary: string;
  average_rating: number;
  review_count: number;
  created_at: string;
  is_in_wishlist: boolean;
}

export interface WishlistAccommodationInfos {
  wishlist_accommodations: WishlistAccommodationInfo[];
  page_info: CursorPageInfo;
}

export type GetWishlistAccommodationsResponse = ApiResponse<WishlistAccommodationInfos>;


