import { useCallback, useState } from "react";

export interface SearchBarDatesState {
  checkIn: Date | null;
  checkOut: Date | null;
  setDateRange: (checkIn: Date | null, checkOut: Date | null) => void;
  completeCheckoutIfNeeded: () => void;
  handleDateSelect: (
    checkIn: Date | null,
    checkOut: Date | null,
  ) => void;
}

export const useSearchBarDates = (): SearchBarDatesState => {
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);

  const setDateRange = useCallback(
    (nextCheckIn: Date | null, nextCheckOut: Date | null) => {
      setCheckIn(nextCheckIn);
      setCheckOut(nextCheckOut);
    },
    [],
  );

  const completeCheckoutIfNeeded = useCallback(() => {
    if (!checkIn || checkOut) {
      return;
    }

    const nextDay = new Date(checkIn);
    nextDay.setDate(nextDay.getDate() + 1);
    setCheckOut(nextDay);
  }, [checkIn, checkOut]);

  const handleDateSelect = useCallback(
    (nextCheckIn: Date | null, nextCheckOut: Date | null) => {
      if (
        nextCheckIn &&
        nextCheckOut &&
        nextCheckOut.getTime() < nextCheckIn.getTime()
      ) {
        setDateRange(nextCheckOut, nextCheckIn);
        return;
      }

      setDateRange(nextCheckIn, nextCheckOut);
    },
    [setDateRange],
  );

  return {
    checkIn,
    checkOut,
    completeCheckoutIfNeeded,
    handleDateSelect,
    setDateRange,
  };
};
