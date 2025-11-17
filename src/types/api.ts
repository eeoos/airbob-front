// API 공통 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ErrorResponse | null;
}

export interface ErrorResponse {
  message: string;
  status: number;
  code: string;
  errors?: FieldError[];
}

export interface FieldError {
  field: string;
  value: string;
  reason: string;
}

// 페이지네이션 (Cursor 기반)
export interface CursorPageInfo {
  has_next: boolean;
  next_cursor: string | null;
  current_size: number;
}

// 페이지네이션 (Offset 기반)
export interface PageInfo {
  page_size: number;
  current_page: number;
  total_pages: number;
  total_elements: number;
  is_first: boolean;
  is_last: boolean;
  has_next: boolean;
  has_previous: boolean;
}





