import { ApiResponse } from "./api";

export type CommonCodeGroup = "AMENITY_TYPE" | "ACCOMMODATION_TYPE" | string;

export interface CommonCode {
  code: string;
  name: string;
  sort_order: number;
}

export type GetCommonCodesResponse = ApiResponse<CommonCode[]>;
