import { client } from "./client";
import {
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  GetPaymentResponse,
} from "../types/payment";
import { ApiResponse } from "../types/api";

export const paymentApi = {
  // 결제 확인
  confirm: async (request: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse> => {
    const response = await client.post<ConfirmPaymentResponse>("/payments/confirm", request);
    return response.data;
  },

  // 결제 조회 (paymentKey)
  getByPaymentKey: async (paymentKey: string): Promise<GetPaymentResponse> => {
    const response = await client.get<GetPaymentResponse>(`/payments/${paymentKey}`);
    return response.data;
  },

  // 결제 조회 (orderId)
  getByOrderId: async (orderId: string): Promise<GetPaymentResponse> => {
    const response = await client.get<GetPaymentResponse>(`/payments/orders/${orderId}`);
    return response.data;
  },
};





