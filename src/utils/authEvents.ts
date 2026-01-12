// src/utils/authEvents.ts

type AuthErrorListener = () => void;

// 리스너들을 저장할 집합 (중복 방지)
const listeners = new Set<AuthErrorListener>();

// 쓰로틀링을 위한 플래그
let isTriggering = false;

/**
 * 인증 에러 이벤트 구독 (Subscribe)
 * @param listener 실행할 콜백 함수
 * @returns 구독 해제(Unsubscribe) 함수
 */
export const onAuthError = (listener: AuthErrorListener) => {
  listeners.add(listener);
  
  // Clean-up 함수 반환
  return () => {
    listeners.delete(listener);
  };
};

/**
 * 인증 에러 이벤트 발행 (Publish)
 * - 401 에러 발생 시 호출
 * - 1초 내 중복 호출 방지 (Throttling)
 */
export const triggerAuthError = () => {
  if (isTriggering) return;

  isTriggering = true;
  
  // 등록된 모든 리스너 실행
  listeners.forEach((listener) => listener());

  // 1초 후 락 해제
  setTimeout(() => {
    isTriggering = false;
  }, 1000);
};