import { ApiResponse } from "./api";
import { PaymentStatus } from "./enums";

// 결제 확인 요청
export interface ConfirmPaymentRequest {
  payment_key: string;
  order_id: string;
  amount: number;
}

export type ConfirmPaymentResponse = ApiResponse<null>;

// 결제 취소 정보
export interface CancelInfo {
  cancel_amount: number;
  cancel_reason: string;
  canceled_at: string;
}

// 가상계좌 정보
export interface VirtualAccountInfo {
  account_number: string;
  bank_code: string;
  customer_name: string;
  due_date: string;
}

// 결제 정보
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
  virtual_account?: VirtualAccountInfo | null;
}

export type GetPaymentResponse = ApiResponse<PaymentInfo>;
