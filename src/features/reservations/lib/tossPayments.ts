import { getPublicRuntimeConfig } from "../../../platform/config/publicRuntimeConfig";
import {
  createTossPaymentsV1Client,
  ensureTossPaymentsV1Script,
  type TossPaymentsV1Client,
} from "../../../platform/integrations/tossPaymentsV1";

export type TossPaymentsClient = TossPaymentsV1Client;

// Preserve the legacy feature import while the checkout workflow remains on v1.
export const ensureTossPaymentsScript = ensureTossPaymentsV1Script;

export const getTossClientKey = () => {
  const tossClientKey = getPublicRuntimeConfig().tossClientKey;

  if (!tossClientKey) {
    throw new Error("결제 설정이 올바르지 않습니다.");
  }

  return tossClientKey;
};

export const getTossPaymentsClient = (clientKey = getTossClientKey()) => {
  try {
    return createTossPaymentsV1Client(clientKey);
  } catch {
    throw new Error("결제 시스템을 불러올 수 없습니다.");
  }
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

export const shouldSilentlyResetPayment = (error: unknown): boolean => {
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

export const toReservationPaymentError = (error: unknown): Error => {
  const errorMessage = getTossErrorMessage(error);

  if (errorMessage.includes("인증") || errorMessage.includes("Unauthorized")) {
    return new Error(
      "Toss Payments 클라이언트 키 인증에 실패했습니다. " +
        "클라이언트 키가 올바른지 확인해주세요. " +
        "샌드박스 환경에서는 'test_ck_'로 시작하는 키를 사용해야 합니다.",
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(errorMessage || "결제 진행 중 오류가 발생했습니다.");
};
