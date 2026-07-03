import { useCallback, useEffect, useState } from "react";
import { reservationApi } from "../../../api";
import { routeTo } from "../../../routes/paths";
import {
  ensureTossPaymentsScript,
  getTossClientKey,
  getTossPaymentsClient,
  shouldSilentlyResetPayment,
  toReservationPaymentError,
} from "../lib/tossPayments";

interface UseReservationPaymentOptions {
  clearError: () => void;
  handleError: (error: unknown) => void;
}

interface StartReservationPaymentOptions {
  accommodationId: number;
  checkIn: Date;
  checkOut: Date;
  adultCount: number;
  childCount: number;
}

interface PendingPayment {
  reservationUid: string;
  orderName: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  tossClientKey: string;
}

const formatDateForUrl = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function useReservationPayment({
  clearError,
  handleError,
}: UseReservationPaymentOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(
    null
  );

  useEffect(() => {
    ensureTossPaymentsScript();
  }, []);

  const startReservationPayment = useCallback(
    async ({
      accommodationId,
      checkIn,
      checkOut,
      adultCount,
      childCount,
    }: StartReservationPaymentOptions) => {
      setIsLoading(true);
      clearError();
      setPendingPayment(null);

      try {
        const reservationResponse = await reservationApi.create({
          accommodation_id: accommodationId,
          check_in_date: formatDateForUrl(checkIn),
          check_out_date: formatDateForUrl(checkOut),
          guest_count: adultCount + childCount,
        });

        const {
          reservation_uid,
          order_name,
          amount,
          customer_email,
          customer_name,
        } = reservationResponse;

        const tossClientKey = getTossClientKey();

        setPendingPayment({
          reservationUid: reservation_uid,
          orderName: order_name,
          amount,
          customerEmail: customer_email,
          customerName: customer_name,
          tossClientKey,
        });
        setIsProcessingPayment(true);
      } catch (error) {
        handleError(error);
        setIsLoading(false);
        setIsProcessingPayment(false);
        setPendingPayment(null);
      }
    },
    [clearError, handleError]
  );

  useEffect(() => {
    if (!pendingPayment || !isProcessingPayment) {
      return;
    }

    let isCancelled = false;

    const resetPaymentState = () => {
      if (isCancelled) {
        return;
      }

      setIsLoading(false);
      setIsProcessingPayment(false);
      setPendingPayment(null);
    };

    const requestTossPayment = async () => {
      try {
        const paymentWidget = getTossPaymentsClient(pendingPayment.tossClientKey);
        const paymentMethodsWidget = paymentWidget.widgets({
          customerKey: pendingPayment.customerEmail,
        });

        await paymentMethodsWidget.renderPaymentMethods(
          "#payment-widget",
          { value: pendingPayment.amount },
          { variantKey: "DEFAULT" }
        );

        await paymentWidget.requestPayment({
          orderId: pendingPayment.reservationUid,
          orderName: pendingPayment.orderName,
          successUrl: `${window.location.origin}${routeTo.paymentSuccess(pendingPayment.reservationUid)}`,
          failUrl: `${window.location.origin}${routeTo.paymentFail(pendingPayment.reservationUid)}`,
          customerEmail: pendingPayment.customerEmail,
          customerName: pendingPayment.customerName,
          amount: pendingPayment.amount,
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        if (shouldSilentlyResetPayment(error)) {
          resetPaymentState();
          return;
        }

        handleError(toReservationPaymentError(error));
        resetPaymentState();
      }
    };

    requestTossPayment();

    return () => {
      isCancelled = true;
    };
  }, [handleError, isProcessingPayment, pendingPayment]);

  return {
    isLoading,
    isProcessingPayment,
    startReservationPayment,
  };
}
