const CALENDAR_CELL_COUNT = 42;
const MAX_KEYBOARD_SEARCH_DAYS = 730;

export const DAYS_PER_WEEK = 7;

export const WEEKDAYS = [
  { short: "일", long: "일요일" },
  { short: "월", long: "월요일" },
  { short: "화", long: "화요일" },
  { short: "수", long: "수요일" },
  { short: "목", long: "목요일" },
  { short: "금", long: "금요일" },
  { short: "토", long: "토요일" },
] as const;

export const formatDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export const formatMonthName = (date: Date): string =>
  date.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

export const formatKoreanDateLabel = (date: Date): string =>
  `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${
    WEEKDAYS[date.getDay()]?.long ?? "요일 미상"
  }`;

export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const startOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const addDays = (date: Date, amount: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);

export const addMonths = (date: Date, amount: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

export const addMonthsPreservingDay = (date: Date, amount: number): Date => {
  const targetMonth = addMonths(date, amount);
  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
  ).getDate();

  return new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(date.getDate(), lastDay),
  );
};

export const getMonthIndex = (date: Date): number =>
  date.getFullYear() * 12 + date.getMonth();

export const getCalendarWeeks = (date: Date): Array<Array<Date | null>> => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Array<Date | null> = Array(firstDay.getDay()).fill(null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length < CALENDAR_CELL_COUNT) {
    days.push(null);
  }

  return Array.from(
    { length: CALENDAR_CELL_COUNT / DAYS_PER_WEEK },
    (_, index) =>
      days.slice(index * DAYS_PER_WEEK, (index + 1) * DAYS_PER_WEEK),
  );
};

export const findClosestEnabledDate = (
  targetDate: Date,
  preferredDirection: -1 | 1,
  isDisabled: (date: Date) => boolean,
): Date | null => {
  for (let distance = 0; distance <= MAX_KEYBOARD_SEARCH_DAYS; distance += 1) {
    const preferredDate = addDays(targetDate, preferredDirection * distance);
    if (!isDisabled(preferredDate)) return preferredDate;

    if (distance > 0) {
      const fallbackDate = addDays(targetDate, -preferredDirection * distance);
      if (!isDisabled(fallbackDate)) return fallbackDate;
    }
  }

  return null;
};

export const getSelectionAnnouncement = (
  checkIn: Date | null,
  checkOut: Date | null,
): string => {
  if (checkIn && checkOut) {
    return `${formatKoreanDateLabel(checkIn)}부터 ${formatKoreanDateLabel(
      checkOut,
    )}까지 선택됨`;
  }

  if (checkIn) {
    return `${formatKoreanDateLabel(
      checkIn,
    )} 체크인 선택됨. 체크아웃 날짜를 선택하세요.`;
  }

  return "날짜를 선택하세요.";
};
