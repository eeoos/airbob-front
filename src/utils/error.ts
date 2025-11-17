import { AxiosError } from "axios";
import { ApiResponse, ErrorResponse, FieldError } from "../types/api";

/**
 * API 에러 응답을 파싱합니다.
 */
export const parseApiError = (error: unknown): ErrorResponse | null => {
  if (error instanceof AxiosError) {
    // response.data가 있는 경우
    if (error.response?.data) {
      const response = error.response.data as ApiResponse<null> | undefined;
      if (response && typeof response === 'object' && 'success' in response) {
        if (!response.success && response.error) {
          return response.error;
        }
      }
    }
    // response.data가 없거나 형식이 맞지 않는 경우
    // HTTP 상태 코드로 에러 메시지 생성
    if (error.response) {
      return {
        message: error.message || "요청 처리 중 오류가 발생했습니다.",
        status: error.response.status,
        code: `HTTP_${error.response.status}`,
      };
    }
    // 네트워크 에러 등
    return {
      message: error.message || "네트워크 오류가 발생했습니다.",
      status: 0,
      code: "NETWORK_ERROR",
    };
  }
  
  // 일반 Error 객체인 경우
  if (error instanceof Error) {
    return {
      message: error.message,
      status: 500,
      code: "UNKNOWN_ERROR",
    };
  }
  
  return null;
};

/**
 * 에러 코드에 따른 사용자 친화적 메시지를 반환합니다.
 */
export const getErrorMessage = (errorCode: string, defaultMessage?: string): string => {
  const errorMessages: Record<string, string> = {
    // Common
    C001: "입력한 정보를 확인해주세요.",
    C002: "지원하지 않는 요청입니다.",
    C003: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    C004: "잘못된 형식의 값입니다.",
    C005: "페이지 정보 처리 중 오류가 발생했습니다.",
    C006: "페이지 크기는 1 이상이어야 합니다.",
    C007: "요청 처리 중 오류가 발생했습니다.",
    C008: "이벤트 처리 중 오류가 발생했습니다.",
    C009: "요청 정보가 일치하지 않습니다.",

    // Auth & Member
    M001: "존재하지 않거나 활성 상태가 아닌 사용자입니다.",
    M002: "이미 존재하는 이메일입니다.",
    M003: "비밀번호가 일치하지 않습니다.",
    M004: "로그인이 필요합니다.",
    M005: "숙소에 대한 수정/삭제 권한이 없습니다.",

    // Accommodation
    A001: "존재하지 않거나 삭제된 숙소입니다.",
    A002: "숙소에 대한 접근 권한이 없습니다.",
    A003: "숙소 게시를 위한 필수 정보가 누락되었습니다.",
    A005: "숙소 가격이 유효하지 않습니다.",
    A006: "숙소 이미지가 최소 요구 개수 미만입니다.",

    // Reservation
    R001: "존재하지 않는 예약입니다.",
    R002: "해당 날짜는 다른 예약과 겹쳐 예약이 불가능합니다.",
    R003: "동시에 많은 예약이 시도되어 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
    R004: "결제 완료 상태의 예약만 취소할 수 있습니다.",
    R005: "결제 대기 상태의 예약만 확정할 수 있습니다.",
    R006: "결제 대기 상태의 예약만 만료시킬 수 있습니다.",
    R007: "예약 상태 변경 중 오류가 발생했습니다.",
    R008: "해당 예약에 대한 접근 권한이 없습니다.",
    R009: "체크아웃 날짜는 체크인 날짜보다 이후여야 합니다.",

    // Payment
    P001: "존재하지 않는 결제 정보입니다.",
    P002: "결제 처리 중 오류가 발생했습니다.",
    P003: "결제 응답 처리 중 오류가 발생했습니다.",
    P004: "해당 결제 정보에 대한 접근 권한이 없습니다.",

    // Wishlist
    W001: "존재하지 않는 위시리스트입니다.",
    W002: "위시리스트에 대한 접근 권한이 없습니다.",
    W003: "존재하지 않는 위시리스트 항목입니다.",
    W004: "이미 위시리스트에 추가된 숙소입니다.",
    W005: "위시리스트 항목에 대한 접근 권한이 없습니다.",

    // Review
    V001: "존재하지 않는 리뷰입니다.",
    V002: "리뷰 요약 정보를 찾을 수 없습니다.",
    V003: "리뷰를 작성할 권한이 없습니다.",
    V004: "이미 리뷰를 작성했습니다.",
    V005: "게시된 리뷰만 수정할 수 있습니다.",
    V006: "해당 리뷰에 대한 권한이 없습니다.",

    // Discount
    D001: "존재하지 않는 할인정책입니다.",

    // Image
    I001: "이미지 업로드 중 오류가 발생했습니다.",
    I002: "이미지 삭제 중 오류가 발생했습니다.",
    I003: "지원하지 않는 이미지 형식입니다. (JPG, PNG만 가능합니다)",
    I004: "요청한 이미지를 찾을 수 없습니다.",
    I005: "해당 이미지에 대한 권한이 없습니다.",
    I007: "이미지 파일이 비어 있습니다.",
    I008: "이미지 파일 크기는 10MB를 초과할 수 없습니다.",
  };

  return errorMessages[errorCode] || defaultMessage || "오류가 발생했습니다.";
};

/**
 * 필드 에러 메시지를 포맷팅합니다.
 */
export const formatFieldErrors = (errors?: FieldError[]): string => {
  if (!errors || errors.length === 0) {
    return "";
  }

  return errors.map((error) => `${error.field}: ${error.reason}`).join("\n");
};

/**
 * API 에러를 사용자 친화적 메시지로 변환합니다.
 */
export const getApiErrorMessage = (error: unknown): string => {
  const apiError = parseApiError(error);
  if (!apiError) {
    return "알 수 없는 오류가 발생했습니다.";
  }

  const message = getErrorMessage(apiError.code, apiError.message);
  
  // 필드 에러가 있으면 추가 정보 제공
  if (apiError.errors && apiError.errors.length > 0) {
    const fieldErrors = formatFieldErrors(apiError.errors);
    return fieldErrors ? `${message}\n${fieldErrors}` : message;
  }

  return message;
};

/**
 * 에러가 인증 관련인지 확인합니다.
 */
export const isAuthError = (error: unknown): boolean => {
  const apiError = parseApiError(error);
  if (!apiError) return false;

  return apiError.code === "M004" || apiError.status === 401;
};

