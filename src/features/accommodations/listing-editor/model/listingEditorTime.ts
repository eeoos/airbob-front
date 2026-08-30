export const formatListingEditorTime = (
  hour: number,
  minute: number,
  period: "AM" | "PM",
): string => {
  let hour24 = hour;
  if (period === "PM" && hour !== 12) hour24 += 12;
  if (period === "AM" && hour === 12) hour24 = 0;

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export const parseListingEditorTime = (
  time: string,
): { readonly hour: number; readonly minute: number; readonly period: "AM" | "PM" } => {
  const [rawHour = "0", rawMinute = "0"] = time.split(":");
  const hour24 = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;

  return {
    hour: Number.isFinite(hour) ? hour : 12,
    minute: Number.isFinite(minute) ? minute : 0,
    period,
  };
};
