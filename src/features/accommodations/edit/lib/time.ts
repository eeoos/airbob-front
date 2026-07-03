export type TimePeriod = "AM" | "PM";

export interface ParsedTime {
  hour: number;
  minute: number;
  period: TimePeriod;
  originalHour: number;
}

export const parseTime = (time: string): ParsedTime => {
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const period: TimePeriod = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  return { hour: displayHour, minute, period, originalHour: hour };
};

export const formatTime = (
  hour: number,
  minute: number,
  period: TimePeriod
): string => {
  let hour24 = hour;
  if (period === "PM" && hour !== 12) {
    hour24 = hour + 12;
  } else if (period === "AM" && hour === 12) {
    hour24 = 0;
  }

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
