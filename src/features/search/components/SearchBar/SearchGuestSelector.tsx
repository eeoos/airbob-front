import { CounterStepper } from "../../../../shared/ui";
import styles from "./SearchBar.module.css";

interface GuestCounterConfig {
  decrementLabel: string;
  incrementLabel: string;
  label: string;
  min: number;
  onChange: (value: number) => void;
  subLabel: string;
  value: number;
}

interface SearchGuestSelectorProps {
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
  onAdultChange: (value: number) => void;
  onChildChange: (value: number) => void;
  onInfantChange: (value: number) => void;
  onPetChange: (value: number) => void;
}

export const SearchGuestSelector = ({
  adultOccupancy,
  childOccupancy,
  infantOccupancy,
  onAdultChange,
  onChildChange,
  onInfantChange,
  onPetChange,
  petOccupancy,
}: SearchGuestSelectorProps) => {
  const counters: GuestCounterConfig[] = [
    {
      decrementLabel: "성인 인원 줄이기",
      incrementLabel: "성인 인원 늘리기",
      label: "성인",
      min: 1,
      onChange: onAdultChange,
      subLabel: "13세 이상",
      value: adultOccupancy,
    },
    {
      decrementLabel: "어린이 인원 줄이기",
      incrementLabel: "어린이 인원 늘리기",
      label: "어린이",
      min: 0,
      onChange: onChildChange,
      subLabel: "2~12세",
      value: childOccupancy,
    },
    {
      decrementLabel: "유아 인원 줄이기",
      incrementLabel: "유아 인원 늘리기",
      label: "유아",
      min: 0,
      onChange: onInfantChange,
      subLabel: "2세 미만",
      value: infantOccupancy,
    },
    {
      decrementLabel: "반려동물 수 줄이기",
      incrementLabel: "반려동물 수 늘리기",
      label: "반려동물",
      min: 0,
      onChange: onPetChange,
      subLabel: "반려동물을 데려오시나요?",
      value: petOccupancy,
    },
  ];

  return (
    <>
      {counters.map((counter) => (
        <div className={styles.guestRow} key={counter.label}>
          <div>
            <div className={styles.guestLabel}>{counter.label}</div>
            <div className={styles.guestSubLabel}>{counter.subLabel}</div>
          </div>
          <div className={styles.guestControls}>
            <CounterStepper
              decrementLabel={counter.decrementLabel}
              incrementLabel={counter.incrementLabel}
              min={counter.min}
              onChange={counter.onChange}
              value={counter.value}
            />
          </div>
        </div>
      ))}
    </>
  );
};
