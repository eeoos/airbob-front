import React, { useState, useEffect } from "react";
import styles from "./GuestChangeModal.module.css";

interface GuestChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  adultCount: number;
  childCount: number;
  infantCount: number;
  petCount: number;
  maxGuests?: number;
  maxInfants?: number;
  allowsPets?: boolean;
  onSave: (adult: number, child: number, infant: number, pet: number) => void;
}

const GuestChangeModal: React.FC<GuestChangeModalProps> = ({
  isOpen,
  onClose,
  adultCount: initialAdultCount,
  childCount: initialChildCount,
  infantCount: initialInfantCount,
  petCount: initialPetCount,
  maxGuests = 16,
  maxInfants = 0,
  allowsPets = false,
  onSave,
}) => {
  const [adultCount, setAdultCount] = useState(initialAdultCount);
  const [childCount, setChildCount] = useState(initialChildCount);
  const [infantCount, setInfantCount] = useState(initialInfantCount);
  const [petCount, setPetCount] = useState(initialPetCount);

  useEffect(() => {
    if (isOpen) {
      setAdultCount(initialAdultCount);
      setChildCount(initialChildCount);
      setInfantCount(initialInfantCount);
      setPetCount(initialPetCount);
    }
  }, [isOpen, initialAdultCount, initialChildCount, initialInfantCount, initialPetCount]);

  if (!isOpen) return null;

  const totalGuests = adultCount + childCount;
  const canIncreaseAdult = totalGuests < maxGuests;
  const canIncreaseChild = totalGuests < maxGuests;
  const canIncreaseInfant = infantCount < maxInfants;
  const canIncreasePet = allowsPets;

  const handleSave = () => {
    onSave(adultCount, childCount, infantCount, petCount);
    onClose();
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>인원수 변경</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            이 숙소의 최대 숙박 인원은 {maxGuests}명(유아 제외)입니다. {allowsPets ? "" : "반려동물 동반은 허용되지 않습니다."}
          </p>

          {/* 성인 */}
          <div className={styles.guestRow}>
            <div className={styles.guestInfo}>
              <div className={styles.guestLabel}>성인</div>
              <div className={styles.guestSubLabel}>13세 이상</div>
            </div>
            <div className={styles.guestControls}>
              <button
                className={styles.controlButton}
                onClick={() => setAdultCount(Math.max(1, adultCount - 1))}
                disabled={adultCount <= 1}
              >
                −
              </button>
              <span className={styles.guestCount}>{adultCount}</span>
              <button
                className={styles.controlButton}
                onClick={() => setAdultCount(adultCount + 1)}
                disabled={!canIncreaseAdult}
              >
                +
              </button>
            </div>
          </div>

          {/* 어린이 */}
          <div className={styles.guestRow}>
            <div className={styles.guestInfo}>
              <div className={styles.guestLabel}>어린이</div>
              <div className={styles.guestSubLabel}>2~12세</div>
            </div>
            <div className={styles.guestControls}>
              <button
                className={styles.controlButton}
                onClick={() => setChildCount(Math.max(0, childCount - 1))}
                disabled={childCount <= 0}
              >
                −
              </button>
              <span className={styles.guestCount}>{childCount}</span>
              <button
                className={styles.controlButton}
                onClick={() => setChildCount(childCount + 1)}
                disabled={!canIncreaseChild}
              >
                +
              </button>
            </div>
          </div>

          {/* 유아 */}
          <div className={styles.guestRow}>
            <div className={styles.guestInfo}>
              <div className={styles.guestLabel}>유아</div>
              <div className={styles.guestSubLabel}>2세 미만</div>
            </div>
            <div className={styles.guestControls}>
              <button
                className={styles.controlButton}
                onClick={() => setInfantCount(Math.max(0, infantCount - 1))}
                disabled={infantCount <= 0}
              >
                −
              </button>
              <span className={styles.guestCount}>{infantCount}</span>
              <button
                className={styles.controlButton}
                onClick={() => setInfantCount(infantCount + 1)}
                disabled={!canIncreaseInfant}
              >
                +
              </button>
            </div>
          </div>

          {/* 반려동물 */}
          <div className={styles.guestRow}>
            <div className={styles.guestInfo}>
              <div className={styles.guestLabel}>반려동물</div>
              <div className={styles.guestSubLabel}>
                {allowsPets ? "보조동물을 동반하시나요?" : "반려동물 동반은 허용되지 않습니다."}
              </div>
            </div>
            <div className={styles.guestControls}>
              <button
                className={styles.controlButton}
                onClick={() => setPetCount(Math.max(0, petCount - 1))}
                disabled={petCount <= 0 || !allowsPets}
              >
                −
              </button>
              <span className={styles.guestCount}>{petCount}</span>
              <button
                className={styles.controlButton}
                onClick={() => setPetCount(petCount + 1)}
                disabled={!canIncreasePet}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            취소
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </>
  );
};

export default GuestChangeModal;


