type MissingValueMessage = (label: string) => string;

const expectedDefinedMessage: MissingValueMessage = (label) =>
  `Expected ${label} to be defined`;

export const createRequireDefined =
  (missingValueMessage: MissingValueMessage = expectedDefinedMessage) =>
  <Value>(value: Value | null | undefined, label: string): Value => {
    if (value == null) {
      throw new Error(missingValueMessage(label));
    }

    return value;
  };

export const requireDefined = createRequireDefined();

export const requireFixtureItem = <Value>(
  items: readonly Value[],
  index: number,
  label: string,
): Value => {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Missing ${label} at index ${index}.`);
  }

  return item;
};
