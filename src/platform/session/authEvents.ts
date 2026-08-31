interface AuthErrorEvent {
  readonly sequence: number;
}

type AuthErrorListener = (event: AuthErrorEvent) => void;

const listeners = new Set<AuthErrorListener>();
let sequence = 0;

export const onAuthError = (listener: AuthErrorListener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/**
 * Repetition is intentionally not time-throttled. The app session reducer owns
 * idempotence so a real error from a newly established session is never lost.
 */
export const triggerAuthError = () => {
  const event = { sequence: ++sequence };

  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // A faulty observer must not prevent the session owner from receiving it.
    }
  });
};
