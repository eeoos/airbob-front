import React from "react";
import { ToastHost } from "../../shared/ui";

interface ErrorToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  duration,
  message,
  onClose,
}) => (
  <ToastHost
    closeLabel="오류 닫기"
    duration={duration}
    message={message}
    onClose={onClose}
  />
);




