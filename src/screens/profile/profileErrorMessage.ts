import { readStringField } from "../../shared/lib/readStringField";

export const HOST_LISTING_PUBLICATION_ERROR_MESSAGE =
  "요청은 처리됐지만 목록을 갱신하지 못했습니다. 페이지를 다시 열어 확인해주세요.";

export const toProfileReadErrorMessage = (error: unknown): string => {
  const kind = readStringField(error, "kind");
  if (kind === "network" || kind === "timeout") {
    return "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
  }
  if (kind === "authentication") return "로그인이 필요합니다.";

  return "목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
};

export const toHostListingActionErrorMessage = (error: unknown): string => {
  const code = readStringField(error, "code");
  const byCode: Readonly<Record<string, string>> = {
    A001: "존재하지 않거나 삭제된 숙소입니다.",
    A002: "숙소에 대한 접근 권한이 없습니다.",
    A003: "숙소 게시를 위한 필수 정보가 누락되었습니다.",
    M005: "숙소에 대한 수정/삭제 권한이 없습니다.",
  };
  if (code && byCode[code]) return byCode[code];

  const kind = readStringField(error, "kind");
  if (kind === "network" || kind === "timeout" || kind === "server") {
    return "처리 결과를 확인할 수 없습니다. 목록을 새로 확인해주세요.";
  }
  if (kind === "authentication") return "로그인이 필요합니다.";

  return "숙소 관리 요청을 처리하지 못했습니다.";
};
