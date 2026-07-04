export const formatKoreanDate = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
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
