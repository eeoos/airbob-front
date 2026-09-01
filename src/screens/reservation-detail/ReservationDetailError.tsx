import { ToastHost } from "../../shared/ui";

interface ReservationDetailErrorProps {
  readonly className: string;
  readonly message: string | null;
  readonly onDismiss: () => void;
  readonly toastClassName: string;
}

export function ReservationDetailError({
  className,
  message,
  onDismiss,
  toastClassName,
}: ReservationDetailErrorProps) {
  return (
    <>
      <div className={className}>예약 정보를 불러오지 못했습니다.</div>
      {message && (
        <div className={toastClassName}>
          <ToastHost
            closeLabel="오류 닫기"
            message={message}
            onClose={onDismiss}
          />
        </div>
      )}
    </>
  );
}
