import { Dialog } from "../../../shared/ui";
import styles from "./AccommodationDescriptionModal.module.css";

interface AccommodationDescriptionModalProps {
  isOpen: boolean;
  description: string;
  onClose: () => void;
}

export function AccommodationDescriptionModal({
  isOpen,
  description,
  onClose,
}: AccommodationDescriptionModalProps) {
  const lines = description.split("\n");

  return (
    <Dialog
      isOpen={isOpen}
      title="숙소 설명"
      onClose={onClose}
      showHeader={false}
      size="custom"
      bodyPadding="none"
      className={styles.descriptionModalContent}
      bodyClassName={styles.descriptionModalBody}
    >
      <button
        type="button"
        className={styles.descriptionModalClose}
        aria-label="숙소 설명 닫기"
        onClick={onClose}
      >
        ×
      </button>
      <h2 className={styles.descriptionModalTitle}>숙소 설명</h2>
      <div className={styles.descriptionModalText}>
        {lines.map((line, index) => (
          <span key={`${line}-${index}`}>
            {line}
            {index < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
    </Dialog>
  );
}
