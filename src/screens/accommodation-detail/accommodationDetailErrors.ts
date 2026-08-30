export const getAccommodationErrorCode = (error: unknown): string | null =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string"
    ? error.code
    : null;

const getAccommodationErrorKind = (error: unknown): string | null =>
  typeof error === "object" &&
  error !== null &&
  "kind" in error &&
  typeof error.kind === "string"
    ? error.kind
    : null;

export const toAccommodationErrorMessage = (error: unknown): string => {
  const code = getAccommodationErrorCode(error);
  const byCode: Readonly<Record<string, string>> = {
    A001: "존재하지 않거나 삭제된 숙소입니다.",
    CP001: "존재하지 않는 쿠폰입니다.",
    CP002: "쿠폰이 모두 소진되었습니다.",
    CP004: "쿠폰 발급에 실패했습니다. 잠시 후 다시 시도해주세요.",
    CP005: "발급할 수 없는 쿠폰입니다.",
    R002: "해당 날짜는 다른 예약과 겹쳐 예약이 불가능합니다.",
    R003: "동시에 많은 예약이 시도되어 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
  };
  if (code && byCode[code]) return byCode[code];

  const kind = getAccommodationErrorKind(error);
  if (kind === "network" || kind === "timeout") {
    return "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
  }
  if (kind === "authentication") return "로그인이 필요합니다.";

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
};
