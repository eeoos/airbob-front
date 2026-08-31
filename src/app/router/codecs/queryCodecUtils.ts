export type SearchParamsInput = string | URLSearchParams;

export const toSearchParams = (input: SearchParamsInput): URLSearchParams =>
  input instanceof URLSearchParams
    ? new URLSearchParams(input.toString())
    : new URLSearchParams(input.replace(/^\?+/, ""));

export const appendDefinedSearchParam = (
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
) => {
  if (value === null || value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
};

const STRICT_DECIMAL_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseStrictFiniteNumber = (
  value: string | null,
): number | undefined => {
  if (value === null || !STRICT_DECIMAL_PATTERN.test(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseStrictDate = (value: string | null): string | undefined => {
  if (value === null) {
    return undefined;
  }

  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : undefined;
};

export const parsePositiveInteger = (
  value: string | null,
  fallback: number,
): number => {
  if (value === null || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const parseNonNegativeInteger = (
  value: string | null,
  fallback: number,
): number => {
  if (value === null || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
};
