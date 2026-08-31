import { stripVTControlCharacters } from "node:util";

export const COMMITTED_PRIVACY_CANARIES = [
  "artifact-private@example.com",
  "artifact-real-name-canary",
  "artifact-secret-password-canary",
  "paymentKey=artifact-private-payment-key",
];

const sensitiveFieldNames =
  "customer[-_]?email|customer[-_]?name|email|nickname|order[-_]?id|password|payment[-_]?key|access[-_]?token|refresh[-_]?token|session[-_]?token|token|authorization|cookie|api[-_]?key|client[-_]?secret|secret";
const sensitiveFieldReference = `(?:\\b(?:${sensitiveFieldNames})\\b|["'\\x60](?:${sensitiveFieldNames})["'\\x60]|\\\\+["'](?:${sensitiveFieldNames})\\\\+["'])`;
const horizontalWhitespace = "[^\\S\\r\\n]*";
const MAX_STRUCTURED_VALUE_DEPTH = 64;
const structuredValueClosingDelimiter = { "{": "}", "[": "]" };

const isSyntheticEmail = (email) => email.toLowerCase().endsWith(".invalid");

export const normalizeSensitiveText = (input) =>
  stripVTControlCharacters(String(input));

const isQuotedValueCharacter = (character) =>
  character === '"' || character === "'" || character === "`";

const scanQuotedValue = (text, valueStart, quote, initiallyEscaped = false) => {
  let escaped = initiallyEscaped;

  for (let index = valueStart; index < text.length; index += 1) {
    const character = text[index];

    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === quote) {
      return { closingQuoteIndex: index, escaped: false };
    }
  }

  return { closingQuoteIndex: -1, escaped };
};

const readEscapedQuoteDelimiter = (text, delimiterStart) => {
  let quoteIndex = delimiterStart;
  while (text[quoteIndex] === "\\") quoteIndex += 1;

  if (
    quoteIndex === delimiterStart ||
    (text[quoteIndex] !== '"' && text[quoteIndex] !== "'")
  ) {
    return null;
  }

  return {
    quote: text[quoteIndex],
    backslashCount: quoteIndex - delimiterStart,
    valueStart: quoteIndex + 1,
  };
};

const scanEscapedSerializedQuotedValue = (
  text,
  valueStart,
  quote,
  delimiterBackslashCount,
) => {
  for (let quoteIndex = valueStart; quoteIndex < text.length; quoteIndex += 1) {
    if (text[quoteIndex] !== quote) continue;

    let delimiterStart = quoteIndex;
    while (text[delimiterStart - 1] === "\\") delimiterStart -= 1;

    if (quoteIndex - delimiterStart === delimiterBackslashCount) {
      return { closingQuoteIndex: quoteIndex, delimiterStart };
    }
  }

  return { closingQuoteIndex: -1 };
};

const scanStructuredValue = (text, valueStart, initialState) => {
  const stack = [...initialState.stack];
  let quote = initialState.quote ?? null;
  let escaped = initialState.escaped ?? false;

  for (let index = valueStart; index < text.length; index += 1) {
    const character = text[index];

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (isQuotedValueCharacter(character)) {
      quote = character;
      continue;
    }

    const nestedClosingDelimiter = structuredValueClosingDelimiter[character];
    if (nestedClosingDelimiter) {
      if (stack.length >= MAX_STRUCTURED_VALUE_DEPTH) {
        return { closingDelimiterIndex: -1, blocked: true };
      }
      stack.push(nestedClosingDelimiter);
      continue;
    }

    if (character === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) {
        return { closingDelimiterIndex: index, blocked: false };
      }
    }
  }

  return {
    closingDelimiterIndex: -1,
    blocked: false,
    state: { stack, quote, escaped },
  };
};

const redactStructuredAssignments = (text) => {
  const assignmentStartPattern = new RegExp(
    `(${sensitiveFieldReference}${horizontalWhitespace}[:=]${horizontalWhitespace})`,
    "gi",
  );
  let cursor = 0;
  let redacted = "";

  while (assignmentStartPattern.exec(text) !== null) {
    const valueStart = assignmentStartPattern.lastIndex;
    const closingDelimiter = structuredValueClosingDelimiter[text[valueStart]];
    if (!closingDelimiter) continue;

    const structuredValue = scanStructuredValue(text, valueStart + 1, {
      stack: [closingDelimiter],
      quote: null,
      escaped: false,
    });
    redacted += `${text.slice(cursor, valueStart)}[redacted]`;

    if (structuredValue.closingDelimiterIndex < 0) {
      return redacted;
    }

    cursor = structuredValue.closingDelimiterIndex + 1;
    assignmentStartPattern.lastIndex = cursor;
  }

  return `${redacted}${text.slice(cursor)}`;
};

const redactEscapedQuotedAssignments = (text) => {
  const assignmentStartPattern = new RegExp(
    `(${sensitiveFieldReference}${horizontalWhitespace}[:=]${horizontalWhitespace})(\\\\+)(["'])`,
    "gi",
  );
  let cursor = 0;
  let redacted = "";
  let match;

  while ((match = assignmentStartPattern.exec(text)) !== null) {
    const delimiterBackslashes = match[2];
    const quote = match[3];
    const valueStart = assignmentStartPattern.lastIndex;
    const escapedValue = scanEscapedSerializedQuotedValue(
      text,
      valueStart,
      quote,
      delimiterBackslashes.length,
    );
    redacted += `${text.slice(cursor, valueStart)}[redacted]`;

    if (escapedValue.closingQuoteIndex < 0) {
      return redacted;
    }

    redacted += `${delimiterBackslashes}${quote}`;
    cursor = escapedValue.closingQuoteIndex + 1;
    assignmentStartPattern.lastIndex = cursor;
  }

  return `${redacted}${text.slice(cursor)}`;
};

const redactQuotedAssignments = (text) => {
  const assignmentStartPattern = new RegExp(
    `(${sensitiveFieldReference}${horizontalWhitespace}[:=]${horizontalWhitespace})(["'\\x60])`,
    "gi",
  );
  let cursor = 0;
  let redacted = "";
  let match;

  while ((match = assignmentStartPattern.exec(text)) !== null) {
    const quote = match[2];
    const valueStart = assignmentStartPattern.lastIndex;
    let valueEnd = valueStart;
    let escaped = false;

    while (valueEnd < text.length) {
      const character = text[valueEnd];

      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        break;
      }

      valueEnd += 1;
    }

    redacted += `${text.slice(cursor, valueStart)}[redacted]`;

    if (valueEnd >= text.length) {
      // Fail closed when a log line contains a truncated quoted value.
      return redacted;
    }

    redacted += quote;
    cursor = valueEnd + 1;
    assignmentStartPattern.lastIndex = cursor;
  }

  return `${redacted}${text.slice(cursor)}`;
};

const isUnquotedValueDelimiter = (character) =>
  character === "," ||
  character === "}" ||
  character === "]" ||
  character === ")" ||
  character === ";" ||
  character === "&" ||
  character === "\r" ||
  character === "\n";

const redactUnquotedAssignments = (text) => {
  const assignmentStartPattern = new RegExp(
    `(${sensitiveFieldReference}${horizontalWhitespace}[:=]${horizontalWhitespace})`,
    "gi",
  );
  let cursor = 0;
  let redacted = "";

  while (assignmentStartPattern.exec(text) !== null) {
    const valueStart = assignmentStartPattern.lastIndex;

    if (
      isQuotedValueCharacter(text[valueStart]) ||
      readEscapedQuoteDelimiter(text, valueStart) !== null
    ) {
      continue;
    }

    const redactedMarker = "[redacted]";
    const markerEnd = valueStart + redactedMarker.length;
    const startsWithRedactedMarker = text.startsWith(
      redactedMarker,
      valueStart,
    );

    if (
      startsWithRedactedMarker &&
      (markerEnd === text.length || isUnquotedValueDelimiter(text[markerEnd]))
    ) {
      assignmentStartPattern.lastIndex = markerEnd;
      continue;
    }

    let valueEnd = startsWithRedactedMarker ? markerEnd : valueStart;
    while (
      valueEnd < text.length &&
      !isUnquotedValueDelimiter(text[valueEnd])
    ) {
      valueEnd += 1;
    }

    redacted += `${text.slice(cursor, valueStart)}[redacted]`;
    cursor = valueEnd;
    assignmentStartPattern.lastIndex = valueEnd;
  }

  return `${redacted}${text.slice(cursor)}`;
};

export const findSensitiveTextViolations = (text) => {
  const normalizedText = normalizeSensitiveText(text);
  const violations = new Set();

  for (const match of normalizedText.matchAll(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  )) {
    if (!isSyntheticEmail(match[0])) {
      violations.add("non-synthetic-email");
    }
  }

  for (const match of normalizedText.matchAll(
    /(?:^|[?&])(?:orderId|paymentKey|token)=(\[redacted\]|[^&\s"'<>,}\]);]+)/gi,
  )) {
    if (match[1] !== "[redacted]") {
      violations.add("sensitive-callback-query");
    }
  }

  if (/\b(?:live|test)_sk_[A-Za-z0-9_-]+\b/.test(normalizedText)) {
    violations.add("server-secret-key");
  }

  if (/\bBearer\s+[A-Za-z0-9._~+/=-]+/i.test(normalizedText)) {
    violations.add("bearer-credential");
  }

  const assignmentPattern = new RegExp(
    `${sensitiveFieldReference}\\s*[:=]\\s*(?:\\\\*["']|[\\x60])?([^\\\\"'\\x60,}\\s]+)`,
    "gi",
  );
  for (const match of normalizedText.matchAll(assignmentPattern)) {
    const value = match[1];
    if (
      value === "[redacted]" ||
      value.startsWith("synthetic-") ||
      value.includes("테스트") ||
      (value.includes("@") && isSyntheticEmail(value))
    ) {
      continue;
    }

    violations.add("structured-sensitive-value");
  }

  return [...violations].sort();
};

export const redactSensitiveText = (input) => {
  let text = normalizeSensitiveText(input);

  COMMITTED_PRIVACY_CANARIES.forEach((canary) => {
    text = text.split(canary).join("[redacted-canary]");
  });

  text = text.replace(
    /([?&](?:orderId|paymentKey|token)=)(?:\[redacted\]|[^&\s"'<>,}\]);]+)/gi,
    "$1[redacted]",
  );
  text = text.replace(
    /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi,
    "[redacted-email]",
  );
  text = text.replace(
    /\b(?:live|test)_sk_[A-Za-z0-9_-]+\b/g,
    "[redacted-server-key]",
  );
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
  text = text.replace(
    /(https?:\/\/[^\s"'<>]+\/reservations\/)[^/?#\s"'<>]+/gi,
    "$1[redacted]",
  );

  text = redactStructuredAssignments(text);
  text = redactEscapedQuotedAssignments(text);
  text = redactQuotedAssignments(text);

  return redactUnquotedAssignments(text);
};

const extractLineBreaks = (text) => text.replace(/[^\r\n]/g, "");

const findSensitiveAssignmentContinuation = (text) => {
  const assignmentStartPattern = new RegExp(
    `(${sensitiveFieldReference}${horizontalWhitespace}[:=]${horizontalWhitespace})`,
    "gi",
  );

  while (assignmentStartPattern.exec(text) !== null) {
    const valueStart = assignmentStartPattern.lastIndex;
    const firstValueCharacter = text[valueStart];

    if (
      firstValueCharacter === undefined ||
      firstValueCharacter === "\r" ||
      firstValueCharacter === "\n"
    ) {
      return { kind: "awaiting-value" };
    }

    const escapedDelimiter = readEscapedQuoteDelimiter(text, valueStart);
    if (escapedDelimiter) {
      const { quote, backslashCount } = escapedDelimiter;
      const escapedValue = scanEscapedSerializedQuotedValue(
        text,
        escapedDelimiter.valueStart,
        quote,
        backslashCount,
      );
      if (escapedValue.closingQuoteIndex < 0) {
        return {
          kind: "escaped-quoted-value",
          quote,
          delimiterBackslashCount: backslashCount,
          closingDelimiter: `${"\\".repeat(backslashCount)}${quote}`,
          preserveClosingQuote: true,
          suppressedValueStart: escapedDelimiter.valueStart,
        };
      }

      assignmentStartPattern.lastIndex = escapedValue.closingQuoteIndex + 1;
      continue;
    }

    const structuredClosingDelimiter =
      structuredValueClosingDelimiter[firstValueCharacter];
    if (structuredClosingDelimiter) {
      const structuredValue = scanStructuredValue(text, valueStart + 1, {
        stack: [structuredClosingDelimiter],
        quote: null,
        escaped: false,
      });
      if (structuredValue.closingDelimiterIndex < 0) {
        return structuredValue.blocked
          ? {
              kind: "blocked-value",
              suppressedValueStart: valueStart + 1,
            }
          : {
              kind: "structured-value",
              ...structuredValue.state,
              suppressedValueStart: valueStart + 1,
            };
      }

      assignmentStartPattern.lastIndex =
        structuredValue.closingDelimiterIndex + 1;
      continue;
    }

    if (!isQuotedValueCharacter(firstValueCharacter)) {
      continue;
    }

    const quote = firstValueCharacter;
    const quotedValue = scanQuotedValue(text, valueStart + 1, quote);
    if (quotedValue.closingQuoteIndex < 0) {
      return {
        kind: "quoted-value",
        quote,
        escaped: quotedValue.escaped,
        closingDelimiter: quote,
        preserveClosingQuote: true,
        suppressedValueStart: valueStart + 1,
      };
    }

    assignmentStartPattern.lastIndex = quotedValue.closingQuoteIndex + 1;
  }

  return null;
};

const redactFreshText = (text) => {
  const continuation = findSensitiveAssignmentContinuation(text);
  let redacted = redactSensitiveText(text);

  if (
    continuation?.kind === "quoted-value" ||
    continuation?.kind === "escaped-quoted-value" ||
    continuation?.kind === "structured-value" ||
    continuation?.kind === "blocked-value"
  ) {
    // Single-record redaction deliberately truncates an unterminated quoted or
    // structured value. Preserve only record separators while the state
    // machine drops the sensitive continuation itself.
    redacted += extractLineBreaks(
      text.slice(continuation.suppressedValueStart),
    );
  }

  return { redacted, continuation };
};

const consumeQuotedContinuation = (text, continuation) => {
  const quotedValue = scanQuotedValue(
    text,
    0,
    continuation.quote,
    continuation.escaped,
  );

  if (quotedValue.closingQuoteIndex < 0) {
    return {
      redacted: extractLineBreaks(text),
      continuation: {
        ...continuation,
        escaped: quotedValue.escaped,
      },
    };
  }

  const suppressedValue = text.slice(0, quotedValue.closingQuoteIndex);
  const suffix = text.slice(quotedValue.closingQuoteIndex + 1);
  const next = redactFreshText(suffix);

  return {
    redacted:
      extractLineBreaks(suppressedValue) +
      (continuation.preserveClosingQuote ? continuation.closingDelimiter : "") +
      next.redacted,
    continuation: next.continuation,
  };
};

const consumeEscapedQuotedContinuation = (text, continuation) => {
  const escapedValue = scanEscapedSerializedQuotedValue(
    text,
    0,
    continuation.quote,
    continuation.delimiterBackslashCount,
  );

  if (escapedValue.closingQuoteIndex < 0) {
    return {
      redacted: extractLineBreaks(text),
      continuation,
    };
  }

  const suppressedValue = text.slice(0, escapedValue.closingQuoteIndex);
  const suffix = text.slice(escapedValue.closingQuoteIndex + 1);
  const next = redactFreshText(suffix);

  return {
    redacted:
      extractLineBreaks(suppressedValue) +
      (continuation.preserveClosingQuote ? continuation.closingDelimiter : "") +
      next.redacted,
    continuation: next.continuation,
  };
};

const consumeStructuredContinuation = (text, continuation) => {
  const structuredValue = scanStructuredValue(text, 0, continuation);

  if (structuredValue.closingDelimiterIndex < 0) {
    return {
      redacted: extractLineBreaks(text),
      continuation: structuredValue.blocked
        ? { kind: "blocked-value" }
        : { kind: "structured-value", ...structuredValue.state },
    };
  }

  const suppressedValue = text.slice(
    0,
    structuredValue.closingDelimiterIndex + 1,
  );
  const suffix = text.slice(structuredValue.closingDelimiterIndex + 1);
  const next = redactFreshText(suffix);

  return {
    redacted: extractLineBreaks(suppressedValue) + next.redacted,
    continuation: next.continuation,
  };
};

const consumeBlockedContinuation = (text) => ({
  redacted: extractLineBreaks(text),
  continuation: { kind: "blocked-value" },
});

const consumeUnquotedContinuation = (text) => {
  let valueEnd = 0;
  while (valueEnd < text.length && !isUnquotedValueDelimiter(text[valueEnd])) {
    valueEnd += 1;
  }

  if (valueEnd >= text.length) {
    return { redacted: "", continuation: { kind: "unquoted-value" } };
  }

  return redactFreshText(text.slice(valueEnd));
};

const consumeAwaitingValue = (text) => {
  let valueStart = 0;
  let preservedLineBreaks = "";

  while (valueStart < text.length) {
    const character = text[valueStart];

    if (character === "\r" || character === "\n") {
      preservedLineBreaks += character;
      valueStart += 1;
    } else if (/\s/.test(character)) {
      valueStart += 1;
    } else {
      break;
    }
  }

  if (valueStart >= text.length) {
    return {
      redacted: preservedLineBreaks,
      continuation: { kind: "awaiting-value" },
    };
  }

  const firstValueCharacter = text[valueStart];
  const escapedDelimiter = readEscapedQuoteDelimiter(text, valueStart);
  if (escapedDelimiter) {
    const { quote, backslashCount } = escapedDelimiter;
    const quoted = consumeEscapedQuotedContinuation(
      text.slice(escapedDelimiter.valueStart),
      {
        kind: "escaped-quoted-value",
        quote,
        delimiterBackslashCount: backslashCount,
        closingDelimiter: `${"\\".repeat(backslashCount)}${quote}`,
        preserveClosingQuote: false,
      },
    );

    return {
      redacted: preservedLineBreaks + quoted.redacted,
      continuation: quoted.continuation,
    };
  }

  const structuredClosingDelimiter =
    structuredValueClosingDelimiter[firstValueCharacter];
  if (structuredClosingDelimiter) {
    const structured = consumeStructuredContinuation(
      text.slice(valueStart + 1),
      {
        kind: "structured-value",
        stack: [structuredClosingDelimiter],
        quote: null,
        escaped: false,
      },
    );

    return {
      redacted: preservedLineBreaks + structured.redacted,
      continuation: structured.continuation,
    };
  }

  if (isQuotedValueCharacter(firstValueCharacter)) {
    const quoted = consumeQuotedContinuation(text.slice(valueStart + 1), {
      kind: "quoted-value",
      quote: firstValueCharacter,
      escaped: false,
      closingDelimiter: firstValueCharacter,
      preserveClosingQuote: false,
    });

    return {
      redacted: preservedLineBreaks + quoted.redacted,
      continuation: quoted.continuation,
    };
  }

  const unquoted = consumeUnquotedContinuation(text.slice(valueStart));
  return {
    redacted: preservedLineBreaks + unquoted.redacted,
    continuation: unquoted.continuation,
  };
};

/**
 * Creates a constant-space redactor for a single output channel. Sensitive
 * quoted and structured values may span records, so stdout and stderr must
 * each own one rather than redacting completed lines independently.
 */
export const createStreamingSensitiveTextRedactor = () => {
  let continuation = null;

  return {
    redact(input) {
      const text = normalizeSensitiveText(input);
      let result;

      if (continuation?.kind === "quoted-value") {
        result = consumeQuotedContinuation(text, continuation);
      } else if (continuation?.kind === "escaped-quoted-value") {
        result = consumeEscapedQuotedContinuation(text, continuation);
      } else if (continuation?.kind === "structured-value") {
        result = consumeStructuredContinuation(text, continuation);
      } else if (continuation?.kind === "blocked-value") {
        result = consumeBlockedContinuation(text);
      } else if (continuation?.kind === "awaiting-value") {
        result = consumeAwaitingValue(text);
      } else if (continuation?.kind === "unquoted-value") {
        result = consumeUnquotedContinuation(text);
      } else {
        result = redactFreshText(text);
      }

      continuation = result.continuation;
      return result.redacted;
    },
    reset() {
      continuation = null;
    },
  };
};
