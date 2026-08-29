import { isAppError } from "../../../platform/http/errors";

const WISHLIST_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  W001: "존재하지 않는 위시리스트입니다.",
  W002: "위시리스트에 대한 접근 권한이 없습니다.",
  W003: "존재하지 않는 위시리스트 항목입니다.",
  W004: "이미 위시리스트에 추가된 숙소입니다.",
  W005: "위시리스트 항목에 대한 접근 권한이 없습니다.",
  M004: "로그인이 필요합니다.",
};

const getErrorCode = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : null;
};

export const toWishlistErrorMessage = (error: unknown): string => {
  const code = getErrorCode(error);
  if (code && WISHLIST_ERROR_MESSAGES[code]) {
    return WISHLIST_ERROR_MESSAGES[code];
  }

  if (isAppError(error)) {
    switch (error.kind) {
      case "network":
        return "네트워크 오류가 발생했습니다.";
      case "timeout":
        return "요청 시간이 초과되었습니다. 다시 시도해주세요.";
      case "server":
        return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      case "authentication":
        return "로그인이 필요합니다.";
      default:
        return "요청 처리 중 오류가 발생했습니다.";
    }
  }

  return "알 수 없는 오류가 발생했습니다.";
};

export const WISHLIST_CREATED_ONLY_MESSAGE =
  "위시리스트는 만들었지만 숙소 저장에 실패했습니다. 다시 시도해주세요.";

export const WISHLIST_REFRESH_WARNING_MESSAGE =
  "저장은 완료됐지만 최신 상태를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.";
