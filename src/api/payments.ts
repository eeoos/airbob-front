import { client } from "./client";
import { requestApi, requestApiNullable } from "./request";
import { unwrapApiResponse } from "./response";
import {
  ConfirmPaymentRequest,
  PaymentInfo,
} from "../types/payment";
import { ApiResponse } from "../types/api";

if (process.env.NODE_ENV === "test") {
  unwrapApiResponse({ success: true, data: null, error: null } as ApiResponse<null>, {
    allowNull: true,
  });
}

export const paymentApi = {
  // 결제 확인 (PG 승인 요청) - 비동기 처리, 202 Accepted
  confirm: async (request: ConfirmPaymentRequest): Promise<void> => {
    await requestApiNullable(() =>
      client.post<ApiResponse<null>>("/payments/confirm", request)
    );
  },

  // 결제 조회 (paymentKey)
  getByPaymentKey: async (paymentKey: string): Promise<PaymentInfo> => {
    return requestApi(() =>
      client.get<ApiResponse<PaymentInfo>>(`/payments/${paymentKey}`)
    );
  },

  // 결제 조회 (orderId)
  getByOrderId: async (orderId: string): Promise<PaymentInfo> => {
    return requestApi(() =>
      client.get<ApiResponse<PaymentInfo>>(`/payments/orders/${orderId}`)
    );
  },
};
