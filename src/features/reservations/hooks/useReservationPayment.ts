import { useCallback, useState } from "react";
import { reservationApi } from "../../../api";
import { routeTo } from "../../../routes/paths";

declare global {
  interface Window {
    TossPayments: any;
  }
}

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

        if (!window.TossPayments) {
          throw new Error("결제 시스템을 불러올 수 없습니다.");
        }

        setIsProcessingPayment(true);

        const tossClientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;
        if (!tossClientKey) {
          throw new Error("결제 설정이 올바르지 않습니다.");
        }

        const paymentWidget = window.TossPayments(tossClientKey);
        const paymentMethodsWidget = paymentWidget.widgets({
          customerKey: customer_email,
        });

        await paymentMethodsWidget.renderPaymentMethods(
          "#payment-widget",
          { value: amount },
          { variantKey: "DEFAULT" }
        );

        paymentWidget.requestPayment({
          orderId: reservation_uid,
          orderName: order_name,
          successUrl: `${window.location.origin}${routeTo.paymentSuccess(reservation_uid)}`,
          failUrl: `${window.location.origin}${routeTo.paymentFail(reservation_uid)}`,
          customerEmail: customer_email,
          customerName: customer_name,
          amount,
        });
      } catch (error) {
        handleError(error);
        setIsLoading(false);
        setIsProcessingPayment(false);
      }
    },
    [clearError, handleError]
  );

  return {
    isLoading,
    isProcessingPayment,
    startReservationPayment,
  };
}
