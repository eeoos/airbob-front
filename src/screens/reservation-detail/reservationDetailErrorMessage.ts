import { readStringField } from "../../shared/lib/readStringField";

export const toReservationDetailErrorMessage = (error: unknown): string => {
  const code = readStringField(error, "code");

  if (code === "R001") return "존재하지 않는 예약입니다.";
  if (code === "R008") return "해당 예약에 대한 접근 권한이 없습니다.";

  const kind = readStringField(error, "kind");
  if (kind === "network" || kind === "timeout") {
    return "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
  }
  if (kind === "authentication") return "로그인이 필요합니다.";

  return "예약 상세 조회에 실패했습니다.";
};
