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
  if (!isOpen) {
    return null;
  }

  const lines = description.split("\n");

  return (
    <div className={styles.descriptionModal} onClick={onClose}>
      <div
        className={styles.descriptionModalContent}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.descriptionModalClose}
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
      </div>
    </div>
  );
}
