type UnknownRecord = Record<string, unknown>;

export const SESSION_OWNED_AUTH_EVENT_POLICY = "session-owned" as const;

export interface AuthEventPolicyMetadata {
  readonly authEventPolicy?: typeof SESSION_OWNED_AUTH_EVENT_POLICY;
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

/**
 * Session commands report authentication failures directly to SessionProvider.
 * The marker is Axios/request metadata only; it is never sent in a header,
 * query parameter, or request body.
 */
export const sessionOwnedAuthEventPolicy: Readonly<
  Required<AuthEventPolicyMetadata>
> = Object.freeze({
  authEventPolicy: SESSION_OWNED_AUTH_EVENT_POLICY,
});

export const isSessionOwnedAuthEventRequest = (value: unknown): boolean =>
  isRecord(value) &&
  Object.prototype.hasOwnProperty.call(value, "authEventPolicy") &&
  value.authEventPolicy === SESSION_OWNED_AUTH_EVENT_POLICY;
