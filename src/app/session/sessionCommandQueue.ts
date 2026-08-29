export interface SessionCommandQueue {
  run<T>(
    signal: AbortSignal,
    command: () => Promise<T>,
  ): Promise<T>;
}

const createAbortError = () =>
  new DOMException("The session command was aborted.", "AbortError");

const runAbortable = <T>(
  signal: AbortSignal,
  command: () => Promise<T>,
): Promise<T> => {
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;

      settled = true;
      signal.removeEventListener("abort", handleAbort);
      callback();
    };
    const handleAbort = () => settle(() => reject(createAbortError()));
    signal.addEventListener("abort", handleAbort, { once: true });

    Promise.resolve().then(command).then(
      (value) => settle(() => resolve(value)),
      (error) => settle(() => reject(error)),
    );
  });
};

/**
 * Provider-local ordering for cookie-mutating auth requests. Logical callers
 * may be cancelled immediately, but a started transport keeps the physical
 * lane until it settles so a later login/logout cannot overtake it.
 */
export const createSessionCommandQueue = (): SessionCommandQueue => {
  let tail: Promise<void> = Promise.resolve();

  return {
    run: <T,>(
      signal: AbortSignal,
      command: () => Promise<T>,
    ) => {
      const physicalExecution = tail.then(
        () => {
          if (signal.aborted) throw createAbortError();
          return command();
        },
        () => {
          if (signal.aborted) throw createAbortError();
          return command();
        },
      );

      tail = physicalExecution.then(
        () => undefined,
        () => undefined,
      );
      return runAbortable(signal, () => physicalExecution);
    },
  };
};
