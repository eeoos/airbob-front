export const readStringField = (
  value: unknown,
  field: string,
): string | null => {
  if (typeof value !== "object" || value === null || !(field in value)) {
    return null;
  }

  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" ? fieldValue : null;
};
