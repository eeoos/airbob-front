const CALENDAR_LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const parseCalendarLocalDateOrdinal = (
  value: unknown,
): number | null => {
  if (typeof value !== "string") return null;
  const match = CALENDAR_LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1) return null;

  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed.getTime() / MILLISECONDS_PER_DAY;
};

export const isCanonicalCalendarLocalDate = (value: unknown): value is string =>
  typeof value === "string" && parseCalendarLocalDateOrdinal(value) !== null;

export const formatCalendarLocalDate = (date: Date): string => {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const calendarLocalDateToDate = (value: string): Date | null => {
  if (!isCanonicalCalendarLocalDate(value)) return null;

  const [yearText, monthText, dayText] = value.split("-");
  if (!yearText || !monthText || !dayText) return null;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date;
};

export const calendarNightsBetween = (
  startInclusive: string,
  endExclusive: string,
): number | null => {
  const startOrdinal = parseCalendarLocalDateOrdinal(startInclusive);
  const endOrdinal = parseCalendarLocalDateOrdinal(endExclusive);
  if (startOrdinal === null || endOrdinal === null) return null;

  return endOrdinal - startOrdinal;
};

export const addCalendarLocalDateDays = (
  value: string,
  amount: number,
): string | null => {
  const ordinal = parseCalendarLocalDateOrdinal(value);
  if (ordinal === null || !Number.isSafeInteger(amount)) return null;

  return new Date((ordinal + amount) * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
};
