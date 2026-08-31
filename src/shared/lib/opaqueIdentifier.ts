const OPAQUE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export const isOpaqueIdentifier = (value: unknown): value is string =>
  typeof value === "string" && OPAQUE_IDENTIFIER_PATTERN.test(value);
