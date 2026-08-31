type UnknownRecord = Record<string, unknown>;

const SESSION_OWNED_AUTH_EVENT_POLICY = "session-owned" as const;

interface AuthEventPolicyMetadata {
  readonly authEventPolicy?: typeof SESSION_OWNED_AUTH_EVENT_POLICY;
}

export type AuthEventPolicy = Readonly<Required<AuthEventPolicyMetadata>>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

/**
 * Session commands report authentication failures directly to the app session
 * owner. This marker is request metadata only: it never becomes a header,
 * query parameter, or request body field.
 */
export const sessionOwnedAuthEventPolicy: AuthEventPolicy = Object.freeze({
  authEventPolicy: SESSION_OWNED_AUTH_EVENT_POLICY,
});

export const isSessionOwnedAuthEventRequest = (value: unknown): boolean =>
  isRecord(value) &&
  Object.prototype.hasOwnProperty.call(value, "authEventPolicy") &&
  value.authEventPolicy === SESSION_OWNED_AUTH_EVENT_POLICY;
