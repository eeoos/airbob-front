declare const sessionSubjectBrand: unique symbol;

/**
 * Stable, non-PII identity token shared with workflow boundary ports.
 * Consumers must treat the value as opaque.
 */
export type SessionSubject = string & {
  readonly [sessionSubjectBrand]: "SessionSubject";
};

export interface AuthenticatedSessionScope {
  readonly subject: SessionSubject;
  readonly epoch: number;
}

export const isSameAuthenticatedSessionScope = (
  left: AuthenticatedSessionScope,
  right: AuthenticatedSessionScope,
): boolean => left.subject === right.subject && left.epoch === right.epoch;
