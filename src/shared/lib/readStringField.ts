const readField = (value: unknown, field: string): unknown => {
  if (typeof value !== "object" || value === null || !(field in value)) {
    return null;
  }

  return (value as Record<string, unknown>)[field];
};

export const readStringField = (
  value: unknown,
  field: string,
): string | null => {
  const fieldValue = readField(value, field);
  return typeof fieldValue === "string" ? fieldValue : null;
};

export const readBooleanField = (
  value: unknown,
  field: string,
): boolean | null => {
  const fieldValue = readField(value, field);
  return typeof fieldValue === "boolean" ? fieldValue : null;
};
