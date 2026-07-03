import { client } from "./client";
import { requestApi, requestApiNullable } from "./request";
import { unwrapApiResponse } from "./response";
import { ApiResponse } from "../types/api";
import { CouponInfos } from "../types/coupon";

if (process.env.NODE_ENV === "test") {
  unwrapApiResponse({ success: true, data: null, error: null } as ApiResponse<null>, {
    allowNull: true,
  });
}

export const couponApi = {
  getValidCoupons: async (): Promise<CouponInfos> => {
    return requestApi(() => client.get<ApiResponse<CouponInfos>>("/coupons"));
  },

  issue: async (couponId: number): Promise<void> => {
    await requestApiNullable(() =>
      client.post<ApiResponse<null>>(`/coupons/${couponId}/issue`)
    );
  },
};
