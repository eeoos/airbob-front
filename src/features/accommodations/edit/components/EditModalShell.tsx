import React from "react";
import { Dialog } from "../../../../shared/ui";

interface EditModalShellProps {
  title: string;
  modalClassName: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const EditModalShell: React.FC<EditModalShellProps> = ({
  title,
  modalClassName,
  onClose,
  children,
}) => {
  return (
    <Dialog
      isOpen
      title={title}
      onClose={onClose}
      showHeader={false}
      size="custom"
      bodyPadding="none"
      className={modalClassName}
    >
      {children}
    </Dialog>
  );
};
