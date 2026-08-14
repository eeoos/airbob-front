import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";

export interface SearchBarGuestCounts {
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
}

export interface SearchBarGuestsState extends SearchBarGuestCounts {
  setAdultOccupancy: Dispatch<SetStateAction<number>>;
  setChildOccupancy: Dispatch<SetStateAction<number>>;
  setInfantOccupancy: Dispatch<SetStateAction<number>>;
  setPetOccupancy: Dispatch<SetStateAction<number>>;
  setGuestCounts: (counts: SearchBarGuestCounts) => void;
  getTotalGuests: () => number;
}

const resolveCountUpdate = (
  nextValue: SetStateAction<number>,
  currentValue: number,
) =>
  typeof nextValue === "function"
    ? (nextValue as (value: number) => number)(currentValue)
    : nextValue;

const clampCount = (value: number, min: number) =>
  Number.isFinite(value) ? Math.max(min, value) : min;

export const useSearchBarGuests = (): SearchBarGuestsState => {
  const [adultOccupancy, setAdultOccupancyState] = useState(1);
  const [childOccupancy, setChildOccupancyState] = useState(0);
  const [infantOccupancy, setInfantOccupancyState] = useState(0);
  const [petOccupancy, setPetOccupancyState] = useState(0);

  const setAdultOccupancy: Dispatch<SetStateAction<number>> = useCallback(
    (nextValue) => {
      setAdultOccupancyState((currentValue) =>
        clampCount(resolveCountUpdate(nextValue, currentValue), 1),
      );
    },
    [],
  );

  const setChildOccupancy: Dispatch<SetStateAction<number>> = useCallback(
    (nextValue) => {
      setChildOccupancyState((currentValue) =>
        clampCount(resolveCountUpdate(nextValue, currentValue), 0),
      );
    },
    [],
  );

  const setInfantOccupancy: Dispatch<SetStateAction<number>> = useCallback(
    (nextValue) => {
      setInfantOccupancyState((currentValue) =>
        clampCount(resolveCountUpdate(nextValue, currentValue), 0),
      );
    },
    [],
  );

  const setPetOccupancy: Dispatch<SetStateAction<number>> = useCallback(
    (nextValue) => {
      setPetOccupancyState((currentValue) =>
        clampCount(resolveCountUpdate(nextValue, currentValue), 0),
      );
    },
    [],
  );

  const setGuestCounts = useCallback(
    ({
      adultOccupancy: nextAdultOccupancy,
      childOccupancy: nextChildOccupancy,
      infantOccupancy: nextInfantOccupancy,
      petOccupancy: nextPetOccupancy,
    }: SearchBarGuestCounts) => {
      setAdultOccupancy(nextAdultOccupancy);
      setChildOccupancy(nextChildOccupancy);
      setInfantOccupancy(nextInfantOccupancy);
      setPetOccupancy(nextPetOccupancy);
    },
    [
      setAdultOccupancy,
      setChildOccupancy,
      setInfantOccupancy,
      setPetOccupancy,
    ],
  );

  const getTotalGuests = useCallback(
    () => adultOccupancy + childOccupancy,
    [adultOccupancy, childOccupancy],
  );

  return {
    adultOccupancy,
    childOccupancy,
    infantOccupancy,
    petOccupancy,
    setAdultOccupancy,
    setChildOccupancy,
    setInfantOccupancy,
    setPetOccupancy,
    setGuestCounts,
    getTotalGuests,
  };
};
