export interface InternalReturnTarget {
  pathname: string;
  search: string;
  hash: string;
}

export interface InternalReturnLocationState {
  from: InternalReturnTarget;
}

const INTERNAL_BASE = "https://airbob.invalid";
const EXPECTED_TARGET_KEYS = new Set<PropertyKey>([
  "pathname",
  "search",
  "hash",
]);
const EXPECTED_LOCATION_STATE_KEYS = new Set<PropertyKey>(["from"]);
const MALFORMED_PERCENT_PATTERN = /%(?![0-9a-f]{2})/i;
const PERCENT_ESCAPE_PATTERN = /%[0-9a-f]{2}/i;
const ENCODED_PATH_SEPARATOR_PATTERN = /%(?:25)*(?:2f|5c)/i;
const ENCODED_CONTROL_CHARACTER_PATTERN =
  /%(?:25)*(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const MAX_PERCENT_DECODE_LAYERS = 8;

type DataRecord = Record<PropertyKey, unknown>;

const isObjectRecord = (value: unknown): value is DataRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyExpectedDataProperties = (
  value: unknown,
  expectedKeys: ReadonlySet<PropertyKey>,
): value is DataRecord => {
  if (!isObjectRecord(value)) {
    return false;
  }

  try {
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== expectedKeys.size ||
      ownKeys.some((key) => !expectedKeys.has(key))
    ) {
      return false;
    }

    return ownKeys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && "value" in descriptor;
    });
  } catch {
    return false;
  }
};

const readDataProperty = (
  value: DataRecord,
  key: PropertyKey,
): unknown => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
};

const containsRawControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 31 || codePoint === 127;
  });

const containsControlCharacter = (value: string): boolean =>
  containsRawControlCharacter(value) ||
  ENCODED_CONTROL_CHARACTER_PATTERN.test(value);

const decodeStructuredPart = (
  value: string,
  rejectPathSeparators: boolean,
): string | null => {
  let current = value;

  for (let layer = 0; layer <= MAX_PERCENT_DECODE_LAYERS; layer += 1) {
    if (
      containsControlCharacter(current) ||
      (rejectPathSeparators &&
        (current.includes("\\") ||
          ENCODED_PATH_SEPARATOR_PATTERN.test(current)))
    ) {
      return null;
    }

    const hasPercentEscape = PERCENT_ESCAPE_PATTERN.test(current);

    if (!hasPercentEscape) {
      return MALFORMED_PERCENT_PATTERN.test(current) ? null : current;
    }

    if (
      layer === MAX_PERCENT_DECODE_LAYERS ||
      MALFORMED_PERCENT_PATTERN.test(current)
    ) {
      return null;
    }

    try {
      current = decodeURIComponent(current);
    } catch {
      return null;
    }
  }

  return null;
};

const isAuthLoopPath = (decodedPathname: string): boolean => {
  const normalized = decodedPathname.replace(/\/+$/, "").toLowerCase();
  return normalized === "/login" || normalized === "/signup";
};

const normalizeTarget = (
  pathname: string,
  search: string,
  hash: string,
): InternalReturnTarget | null => {
  const decodedPathname = decodeStructuredPart(pathname, true);

  if (
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname.includes("?") ||
    pathname.includes("#") ||
    decodedPathname === null ||
    isAuthLoopPath(decodedPathname) ||
    (search !== "" && !search.startsWith("?")) ||
    search.includes("#") ||
    decodeStructuredPart(search, false) === null ||
    (hash !== "" && !hash.startsWith("#")) ||
    decodeStructuredPart(hash, false) === null
  ) {
    return null;
  }

  try {
    const url = new URL(`${pathname}${search}${hash}`, INTERNAL_BASE);
    const decodedNormalizedPathname = decodeStructuredPart(url.pathname, true);

    if (
      url.origin !== INTERNAL_BASE ||
      !url.pathname.startsWith("/") ||
      url.pathname.startsWith("//") ||
      decodedNormalizedPathname === null ||
      isAuthLoopPath(decodedNormalizedPathname)
    ) {
      return null;
    }

    return {
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    };
  } catch {
    return null;
  }
};

export const parseInternalReturnTarget = (
  value: unknown,
): InternalReturnTarget | null => {
  if (!hasOnlyExpectedDataProperties(value, EXPECTED_TARGET_KEYS)) {
    return null;
  }

  const pathname = readDataProperty(value, "pathname");
  const search = readDataProperty(value, "search");
  const hash = readDataProperty(value, "hash");

  return typeof pathname === "string" &&
    typeof search === "string" &&
    typeof hash === "string"
    ? normalizeTarget(pathname, search, hash)
    : null;
};

export const parseInternalReturnLocationState = (
  value: unknown,
): InternalReturnTarget | null => {
  if (!hasOnlyExpectedDataProperties(value, EXPECTED_LOCATION_STATE_KEYS)) {
    return null;
  }

  return parseInternalReturnTarget(readDataProperty(value, "from"));
};

export const serializeInternalReturnTarget = (
  target: InternalReturnTarget,
): string | null => {
  const normalized = parseInternalReturnTarget(target);
  return normalized
    ? `${normalized.pathname}${normalized.search}${normalized.hash}`
    : null;
};

export const createInternalReturnLocationState = (
  target: InternalReturnTarget,
): InternalReturnLocationState | null => {
  const normalized = parseInternalReturnTarget(target);
  return normalized ? { from: normalized } : null;
};

const canonicalizeInternalReturnLocationState = (
  value: unknown,
): string | null => {
  const target = parseInternalReturnLocationState(value);
  return target ? serializeInternalReturnTarget(target) : null;
};

export const internalReturnTargetCodec = {
  parse: parseInternalReturnLocationState,
  parseTarget: parseInternalReturnTarget,
  serialize: serializeInternalReturnTarget,
  canonicalize: canonicalizeInternalReturnLocationState,
  createLocationState: createInternalReturnLocationState,
} as const;
