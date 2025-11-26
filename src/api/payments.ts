import { client } from "./client";
import {
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  GetPaymentResponse,
  PaymentInfo,
} from "../types/payment";
import { ApiResponse } from "../types/api";

export const paymentApi = {
  // 결제 확인 (PG 승인 요청) - 비동기 처리, 202 Accepted
  confirm: async (request: ConfirmPaymentRequest): Promise<void> => {
    await client.post<ApiResponse<null>>("/payments/confirm", request);
  },

  // 결제 조회 (paymentKey)
  getByPaymentKey: async (paymentKey: string): Promise<PaymentInfo> => {
    const response = await client.get<ApiResponse<PaymentInfo>>(`/payments/${paymentKey}`);
    return response.data.data!;
  },

  // 결제 조회 (orderId)
  getByOrderId: async (orderId: string): Promise<PaymentInfo> => {
    const response = await client.get<ApiResponse<PaymentInfo>>(`/payments/orders/${orderId}`);
    return response.data.data!;
  },
};
