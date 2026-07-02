import { client } from "./client";
import { ApiResponse } from "../types/api";
import { CouponInfos } from "../types/coupon";

export const couponApi = {
  getValidCoupons: async (): Promise<CouponInfos> => {
    const response = await client.get<ApiResponse<CouponInfos>>("/coupons");
    return response.data.data || { infos: [] };
  },

  issue: async (couponId: number): Promise<void> => {
    await client.post<ApiResponse<null>>(`/coupons/${couponId}/issue`);
  },
};
