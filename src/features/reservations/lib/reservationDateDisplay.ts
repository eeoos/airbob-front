const getDateOnlyParts = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
};

export const formatKoreanDate = (dateString: string): string => {
  const { year, month, day } = getDateOnlyParts(dateString);
  return `${year}년 ${month}월 ${day}일`;
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
