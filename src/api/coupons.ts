import { client } from "./client";
import { requestApi, requestApiNullable } from "./request";
import { ApiResponse } from "../types/api";
import { CouponInfos } from "../types/coupon";

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
