import { ApiResponse } from "./api";
import { PaymentStatus } from "./enums";

// 결제 확인
export interface ConfirmPaymentRequest {
  payment_key: string;
  order_id: string;
  amount: number;
}

export type ConfirmPaymentResponse = ApiResponse<null>;

// 결제 조회
export interface PaymentInfo {
  order_id: string;
  payment_key: string;
  method: string;
  total_amount: number;
  balance_amount: number;
  status: PaymentStatus;
  requested_at: string;
  approved_at: string | null;
  cancels: CancelInfo[];
}

export interface CancelInfo {
  cancel_amount: number;
  cancel_reason: string;
  canceled_at: string;
}

export type GetPaymentResponse = ApiResponse<PaymentInfo>;

