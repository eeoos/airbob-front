import { useEffect, useState } from "react";
import { paymentApi } from "../../../api";

export type PaymentConfirmationResult =
  | {
      error: null;
      status: "confirmed" | "invalid" | "skipped";
    }
  | {
      error: unknown;
      status: "failed";
    };

interface UsePaymentConfirmationOptions {
  amount: string | null;
  enabled?: boolean;
  orderId: string | null;
  paymentKey: string | null;
}

const parsePaymentAmount = (amount: string): number | null => {
  if (!/^\d+$/.test(amount)) return null;

  const parsedAmount = Number(amount);
  return Number.isSafeInteger(parsedAmount) ? parsedAmount : null;
};

export function usePaymentConfirmation({
  amount,
  enabled = true,
  orderId,
  paymentKey,
}: UsePaymentConfirmationOptions) {
  const [isProcessing, setIsProcessing] = useState(enabled);
  const [result, setResult] = useState<PaymentConfirmationResult | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsProcessing(false);
      setResult(null);
      return;
    }

    let isActive = true;

    const confirmPayment = async () => {
      setIsProcessing(true);
      setResult(null);

      if (!paymentKey || !orderId || !amount) {
        if (isActive) {
          setResult({ status: "skipped", error: null });
          setIsProcessing(false);
        }
        return;
      }

      const parsedAmount = parsePaymentAmount(amount);
      if (parsedAmount === null) {
        if (isActive) {
          setResult({ status: "invalid", error: null });
          setIsProcessing(false);
        }
        return;
      }

      try {
        await paymentApi.confirm({
          payment_key: paymentKey,
          order_id: orderId,
          amount: parsedAmount,
        });

        if (isActive) {
          setResult({ status: "confirmed", error: null });
        }
      } catch (err) {
        if (isActive) {
          setResult({ status: "failed", error: err });
        }
      } finally {
        if (isActive) {
          setIsProcessing(false);
        }
      }
    };

    confirmPayment();

    return () => {
      isActive = false;
    };
  }, [amount, enabled, orderId, paymentKey]);

  return {
    isProcessing,
    result,
  };
}
