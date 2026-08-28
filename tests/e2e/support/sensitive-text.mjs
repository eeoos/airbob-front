export const COMMITTED_PRIVACY_CANARIES = [
  "artifact-private@example.com",
  "artifact-real-name-canary",
  "artifact-secret-password-canary",
  "paymentKey=artifact-private-payment-key",
];

const sensitiveFieldNames =
  "customer_?email|customer_?name|email|nickname|order_?id|password|payment_?key|token";

const isSyntheticEmail = (email) => email.toLowerCase().endsWith(".invalid");

export const findSensitiveTextViolations = (text) => {
  const violations = new Set();

  for (const match of text.matchAll(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  )) {
    if (!isSyntheticEmail(match[0])) {
      violations.add("non-synthetic-email");
    }
  }

  for (const match of text.matchAll(
    /(?:^|[?&])(?:orderId|paymentKey|token)=([^&\s"'<>]+)/gi,
  )) {
    if (match[1] !== "[redacted]") {
      violations.add("sensitive-callback-query");
    }
  }

  if (/\b(?:live|test)_sk_[A-Za-z0-9_-]+\b/.test(text)) {
    violations.add("server-secret-key");
  }

  if (/\bBearer\s+[A-Za-z0-9._~+/=-]+/i.test(text)) {
    violations.add("bearer-credential");
  }

  const assignmentPattern = new RegExp(
    `\\b(?:${sensitiveFieldNames})\\b\\s*[:=]\\s*["']?([^"',}\\s]+)`,
    "gi",
  );
  for (const match of text.matchAll(assignmentPattern)) {
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
  let text = String(input);

  COMMITTED_PRIVACY_CANARIES.forEach((canary) => {
    text = text.split(canary).join("[redacted-canary]");
  });

  text = text.replace(
    /([?&](?:orderId|paymentKey|token)=)[^&\s"'<>]+/gi,
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
  text = text.replace(
    /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    "Bearer [redacted]",
  );
  text = text.replace(
    /(https?:\/\/[^\s"'<>]+\/reservations\/)[^/?#\s"'<>]+/gi,
    "$1[redacted]",
  );

  const quotedAssignmentPattern = new RegExp(
    `(\\b(?:${sensitiveFieldNames})\\b\\s*[:=]\\s*)(["'])(.*?)\\2`,
    "gi",
  );
  text = text.replace(
    quotedAssignmentPattern,
    (_match, prefix, quote) => `${prefix}${quote}[redacted]${quote}`,
  );

  const unquotedAssignmentPattern = new RegExp(
    `(\\b(?:${sensitiveFieldNames})\\b\\s*[:=]\\s*)([^\\s,}]+)`,
    "gi",
  );
  return text.replace(
    unquotedAssignmentPattern,
    (_match, prefix) => `${prefix}[redacted]`,
  );
};
