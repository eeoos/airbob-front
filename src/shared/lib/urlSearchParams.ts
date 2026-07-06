export const appendDefinedSearchParam = (
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined,
) => {
  if (value === null || value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
};

export const toCanonicalSearchString = (params: URLSearchParams) =>
  Array.from(params.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .reduce((nextParams, [key, value]) => {
      nextParams.append(key, value);
      return nextParams;
    }, new URLSearchParams())
    .toString();
