import { useCallback, useEffect, useState } from "react";
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

const getTossErrorCode = (error: unknown): string => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "";
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
};

const getTossErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error !== "object" || error === null || !("message" in error)) {
    return "";
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
};

const shouldSilentlyResetPayment = (error: unknown): boolean => {
  const errorCode = getTossErrorCode(error);
  const errorMessage = getTossErrorMessage(error);

  return (
    errorCode === "USER_CANCEL" ||
    errorMessage.includes("취소") ||
    errorMessage.includes("USER_CANCEL") ||
    errorCode === "BAD_REQUEST" ||
    errorMessage.includes("계약 후 테스트")
  );
};

const toReservationPaymentError = (error: unknown): Error => {
  const errorMessage = getTossErrorMessage(error);

  if (errorMessage.includes("인증") || errorMessage.includes("Unauthorized")) {
    return new Error(
      "Toss Payments 클라이언트 키 인증에 실패했습니다. " +
        "클라이언트 키가 올바른지 확인해주세요. " +
        "샌드박스 환경에서는 'test_ck_'로 시작하는 키를 사용해야 합니다."
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(errorMessage || "결제 진행 중 오류가 발생했습니다.");
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

        if (!window.TossPayments) {
          throw new Error("결제 시스템을 불러올 수 없습니다.");
        }

        const tossClientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;
        if (!tossClientKey) {
          throw new Error("결제 설정이 올바르지 않습니다.");
        }

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
        if (!window.TossPayments) {
          throw new Error("결제 시스템을 불러올 수 없습니다.");
        }

        const paymentWidget = window.TossPayments(pendingPayment.tossClientKey);
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
