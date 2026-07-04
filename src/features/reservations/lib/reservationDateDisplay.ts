const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getDateOnlyParts = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;

export const formatKoreanDate = (dateString: string): string => {
  if (!DATE_ONLY_PATTERN.test(dateString)) {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const { year, month, day } = getDateOnlyParts(dateString);
  return `${year}년 ${month}월 ${day}일`;
};

export const formatKoreanDateWithWeekday = (dateString: string): string => {
  if (DATE_ONLY_PATTERN.test(dateString)) {
    const { year, month, day } = getDateOnlyParts(dateString);
    const date = new Date(year, month - 1, day);
    return `${year}년 ${month}월 ${day}일 (${weekdays[date.getDay()]})`;
  }

  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일 (${weekdays[date.getDay()]})`;
};

export const formatKoreanDateTime = (dateString: string): string =>
  new Date(dateString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatNullablePrice = (price: number | null | undefined): string =>
  price == null ? "-" : `₩${price.toLocaleString()}`;
