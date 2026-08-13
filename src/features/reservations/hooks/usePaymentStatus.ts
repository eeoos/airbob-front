import { useCallback } from "react";
import { paymentApi } from "../../../api";
import { PaymentStatus } from "../../../types/enums";

export type PaymentStatusLookupResult = "done" | "pending" | "error";

interface PaymentStatusLookupRequest {
  amount: number;
  orderId: string;
  paymentKey: string;
}

export const usePaymentStatus = () => {
  const checkPaymentStatus = useCallback(
    async ({
      amount,
      orderId,
      paymentKey,
    }: PaymentStatusLookupRequest): Promise<PaymentStatusLookupResult> => {
      try {
        const payment = await paymentApi.getByPaymentKey(paymentKey);
        const matchesCallback =
          payment.order_id === orderId &&
          payment.total_amount === amount &&
          (!payment.payment_key || payment.payment_key === paymentKey);

        if (!matchesCallback) {
          return "error";
        }

        return payment.status === PaymentStatus.DONE ? "done" : "pending";
      } catch {
        return "error";
      }
    },
    [],
  );

  return { checkPaymentStatus };
};
