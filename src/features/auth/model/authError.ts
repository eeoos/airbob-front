import { isAppError } from "../../../platform/http/errors";

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  M001: "존재하지 않거나 활성 상태가 아닌 사용자입니다.",
  M002: "이미 존재하는 이메일입니다.",
  M003: "비밀번호가 일치하지 않습니다.",
  M004: "로그인이 필요합니다.",
  M005: "숙소에 대한 수정/삭제 권한이 없습니다.",
};

const getErrorCode = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : null;
};

export const toAuthErrorMessage = (error: unknown): string => {
  const code = getErrorCode(error);

  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  if (isAppError(error)) {
    switch (error.kind) {
      case "network":
        return "네트워크 오류가 발생했습니다.";
      case "timeout":
        return "요청 시간이 초과되었습니다. 다시 시도해주세요.";
      case "server":
        return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      default:
        return "요청 처리 중 오류가 발생했습니다.";
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "알 수 없는 오류가 발생했습니다.";
};
