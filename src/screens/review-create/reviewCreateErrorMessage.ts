const backendMessages: Readonly<Record<string, string>> = {
  M004: "로그인이 필요합니다.",
  R001: "존재하지 않는 예약입니다.",
  R404: "예약을 찾을 수 없습니다.",
  R008: "해당 예약에 대한 접근 권한이 없습니다.",
  V003: "리뷰를 작성할 권한이 없습니다.",
  V004: "이미 리뷰를 작성했습니다.",
};
const authenticationRequiredMessage = "로그인이 필요합니다.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const toReviewCreateErrorMessage = (error: unknown): string => {
  if (isRecord(error)) {
    const code = typeof error.code === "string" ? error.code : null;
    const backendMessage = code ? backendMessages[code] : undefined;
    if (backendMessage) return backendMessage;

    if (error.kind === "network" || error.kind === "timeout") {
      return "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
    }
    if (error.kind === "authentication") {
      return authenticationRequiredMessage;
    }
    if (error.kind === "validation") {
      return "리뷰 내용을 확인해주세요.";
    }
  }

  return "리뷰 요청을 처리하지 못했습니다.";
};
