import { ApiResponse } from "./api";

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface CouponInfo {
  id: number;
  name: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  min_payment_price: number | null;
  max_discount_amount: number | null;
  start_date: string;
  end_date: string;
  total_quantity: number | null;
  issued_quantity: number;
}

export interface CouponInfos {
  infos: CouponInfo[];
}

export type GetCouponsResponse = ApiResponse<CouponInfos>;
export type IssueCouponResponse = ApiResponse<null>;
