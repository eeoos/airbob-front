import { client } from "./client";
import { unwrapApiResponse } from "./response";
import { ApiResponse } from "../types/api";
import { CouponInfos } from "../types/coupon";

export const couponApi = {
  getValidCoupons: async (): Promise<CouponInfos> => {
    const response = await client.get<ApiResponse<CouponInfos>>("/coupons");
    return unwrapApiResponse(response.data);
  },

  issue: async (couponId: number): Promise<void> => {
    const response = await client.post<ApiResponse<null>>(`/coupons/${couponId}/issue`);
    unwrapApiResponse(response.data, { allowNull: true });
  },
};
