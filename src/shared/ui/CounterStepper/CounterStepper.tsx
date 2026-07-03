import { IconButton } from "../IconButton";
import styles from "./CounterStepper.module.css";

export interface CounterStepperProps {
  decrementLabel: string;
  incrementLabel: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  value: number;
}

export function CounterStepper({
  decrementLabel,
  incrementLabel,
  max,
  min = 0,
  onChange,
  value,
}: CounterStepperProps) {
  const canDecrement = value > min;
  const canIncrement = max === undefined || value < max;

  const decrement = () => {
    if (canDecrement) {
      onChange(value - 1);
    }
  };

  const increment = () => {
    if (canIncrement) {
      onChange(value + 1);
    }
  };

  return (
    <div className={styles.stepper}>
      <IconButton
        label={decrementLabel}
        size="sm"
        variant="secondary"
        disabled={!canDecrement}
        onClick={decrement}
      >
        -
      </IconButton>
      <span className={styles.value} aria-live="polite">
        {value}
      </span>
      <IconButton
        label={incrementLabel}
        size="sm"
        variant="secondary"
        disabled={!canIncrement}
        onClick={increment}
      >
        +
      </IconButton>
    </div>
  );
}
