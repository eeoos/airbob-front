import { useState } from "react";
import { ToastHost } from "../../../shared/ui";

export function AuthErrorToast({ message }: { readonly message: string }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <ToastHost
      closeLabel="오류 닫기"
      message={message}
      onClose={() => setDismissed(true)}
    />
  );
}
