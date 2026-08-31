import {
  parseNonNegativeSearchInt,
  parsePositiveSearchInt,
  parseStrictDateParam,
} from "./searchParamParsers";

const SEARCH_BAR_URL_PARAM_KEYS = [
  "destination",
  "checkIn",
  "checkOut",
  "adultOccupancy",
  "childOccupancy",
  "infantOccupancy",
  "petOccupancy",
] as const;

export interface SearchBarUrlState {
  destination: string;
  checkIn: Date | null;
  checkOut: Date | null;
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
}

export const getSearchBarUrlStateSignature = (params: URLSearchParams) => {
  const nextParams = new URLSearchParams();

  SEARCH_BAR_URL_PARAM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value !== null) {
      nextParams.set(key, value);
    }
  });

  return nextParams.toString();
};

const parseDateParam = (value: string | null): Date | null => {
  const validValue = parseStrictDateParam(value);
  if (!validValue) {
    return null;
  }

  const [yearValue, monthValue, dayValue] = validValue.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const parseSearchBarUrlState = (
  params: URLSearchParams,
): SearchBarUrlState => ({
  destination: params.get("destination") ?? "",
  checkIn: parseDateParam(params.get("checkIn")),
  checkOut: parseDateParam(params.get("checkOut")),
  adultOccupancy: parsePositiveSearchInt(params.get("adultOccupancy"), 1),
  childOccupancy: parseNonNegativeSearchInt(params.get("childOccupancy"), 0),
  infantOccupancy: parseNonNegativeSearchInt(params.get("infantOccupancy"), 0),
  petOccupancy: parseNonNegativeSearchInt(params.get("petOccupancy"), 0),
});
