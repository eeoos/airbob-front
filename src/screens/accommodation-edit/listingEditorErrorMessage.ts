const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const backendMessages: Readonly<Record<string, string>> = {
  M004: "로그인이 필요합니다.",
  I004: "이미 삭제된 이미지입니다.",
};
const authenticationRequiredMessage = "로그인이 필요합니다.";

export const toListingEditorErrorMessage = (
  error: unknown,
  options: { readonly ambiguous?: boolean } = {},
): string => {
  if (options.ambiguous) {
    return "요청 결과를 확인할 수 없습니다. 새로고침 후 서버 상태를 확인해 주세요.";
  }

  if (isRecord(error)) {
    const code = typeof error.code === "string" ? error.code : null;
    const backendMessage = code ? backendMessages[code] : undefined;
    if (backendMessage) return backendMessage;

    if (error.kind === "network" || error.kind === "timeout") {
      return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
    }
    if (error.kind === "authentication") {
      return authenticationRequiredMessage;
    }
    if (error.kind === "validation") {
      return "입력한 숙소 정보를 확인해 주세요.";
    }
  }

  return "숙소 편집 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
};
