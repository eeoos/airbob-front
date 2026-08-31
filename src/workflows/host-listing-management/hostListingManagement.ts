import type {
  HostListingAction,
  HostListingActionsApiPort,
} from "../../features/accommodations/ports/hostListingActionsApiPort";
import { AppError, normalizeHttpError } from "../../platform/http/errors";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";

export interface HostListingManagementCommand {
  readonly accommodationId: number;
  readonly action: HostListingAction;
}

export interface HostListingManagementPublicationInput extends HostListingManagementCommand {
  readonly scope: AuthenticatedSessionScope;
}

export interface HostListingManagementPublicationPort {
  publishHostListingChanged(
    input: HostListingManagementPublicationInput,
  ): Promise<void>;
}

export interface HostListingManagementRouteLease {
  isCurrent(): boolean;
}

export interface HostListingManagementSessionPort {
  captureAuthenticatedSession(): AuthenticatedSessionScope | null;
  isCurrentSession(scope: AuthenticatedSessionScope): boolean;
}

export interface HostListingManagementDependencies {
  readonly api: HostListingActionsApiPort;
  readonly publication: HostListingManagementPublicationPort;
  readonly routeLease: HostListingManagementRouteLease;
  readonly session: HostListingManagementSessionPort;
}

interface HostListingAppliedResult extends HostListingManagementCommand {
  readonly status: "applied";
  readonly publication:
    | { readonly status: "succeeded" }
    | { readonly status: "failed"; readonly error: AppError };
}

interface HostListingAppliedStaleResult extends HostListingManagementCommand {
  readonly status: "applied-stale";
  readonly publication:
    | { readonly status: "skipped" }
    | { readonly status: "succeeded" }
    | { readonly status: "failed"; readonly error: AppError };
}

export type HostListingManagementResult =
  | HostListingAppliedResult
  | HostListingAppliedStaleResult
  | {
      readonly status: "definitive-failure";
      readonly error: AppError;
    }
  | { readonly status: "ambiguous"; readonly error: AppError }
  | { readonly status: "invalid"; readonly error: AppError }
  | { readonly status: "stale" };

export interface HostListingManagementCommandPort {
  execute(
    command: HostListingManagementCommand,
  ): Promise<HostListingManagementResult>;
}

export interface HostListingManagementWorkflow extends HostListingManagementCommandPort {
  dispose(): void;
}

const STALE_RESULT = Object.freeze({ status: "stale" as const });

export const HOST_LISTING_COMMAND_DEADLINE_MS = 15_000;

const invalidCommandResult = (): HostListingManagementResult => ({
  status: "invalid",
  error: new AppError({
    kind: "validation",
    code: "INVALID_HOST_LISTING_COMMAND",
    message: "A positive accommodation ID is required.",
  }),
});

const authenticationFailure = (): HostListingManagementResult => ({
  status: "definitive-failure",
  error: new AppError({
    kind: "authentication",
    code: "AUTHENTICATED_SESSION_REQUIRED",
    message: "An authenticated session is required.",
  }),
});

const isDefinitiveFailure = (error: AppError): boolean => {
  switch (error.kind) {
    case "authentication":
    case "validation":
    case "conflict":
    case "configuration":
      return true;
    case "http":
      return !error.retryable && (error.status ?? 0) < 500;
    default:
      return false;
  }
};

const isPositiveSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const commandKey = ({
  accommodationId,
  action,
}: HostListingManagementCommand): string => `${action}:${accommodationId}`;

export const createHostListingManagementWorkflow = ({
  api,
  publication,
  routeLease,
  session,
}: HostListingManagementDependencies): HostListingManagementWorkflow => {
  let activeController: AbortController | null = null;
  let activePromise: Promise<HostListingManagementResult> | null = null;
  const terminalPromises = new Map<
    string,
    Promise<HostListingManagementResult>
  >();
  let disposedPromise =
    Promise.resolve<HostListingManagementResult>(STALE_RESULT);
  let disposed = false;

  const isCurrent = (scope: AuthenticatedSessionScope): boolean => {
    if (disposed) return false;

    try {
      return routeLease.isCurrent() && session.isCurrentSession(scope);
    } catch {
      return false;
    }
  };

  const runApiCommand = (
    command: HostListingManagementCommand,
    signal: AbortSignal,
  ): Promise<void> => {
    switch (command.action) {
      case "delete":
        return api.delete(command.accommodationId, { signal });
      case "publish":
        return api.publish(command.accommodationId, { signal });
      case "unpublish":
        return api.unpublish(command.accommodationId, { signal });
    }
  };

  const runApiCommandWithinDeadline = async (
    command: HostListingManagementCommand,
    controller: AbortController,
  ): Promise<void> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new AppError({
            kind: "timeout",
            code: "HOST_LISTING_COMMAND_TIMEOUT",
            message: "The host listing command exceeded its deadline.",
            retryable: true,
          }),
        );
        controller.abort();
      }, HOST_LISTING_COMMAND_DEADLINE_MS);
    });

    try {
      await Promise.race([runApiCommand(command, controller.signal), deadline]);
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  };

  const runCommand = async (
    command: HostListingManagementCommand,
    scope: AuthenticatedSessionScope,
    controller: AbortController,
  ): Promise<HostListingManagementResult> => {
    if (!isCurrent(scope)) return STALE_RESULT;

    try {
      await runApiCommandWithinDeadline(command, controller);
    } catch (error) {
      if (!isCurrent(scope)) return STALE_RESULT;

      const normalized = normalizeHttpError(error);
      return isDefinitiveFailure(normalized)
        ? { status: "definitive-failure", error: normalized }
        : { status: "ambiguous", error: normalized };
    }

    if (!isCurrent(scope)) {
      return {
        ...command,
        status: "applied-stale",
        publication: { status: "skipped" },
      };
    }

    let publicationResult:
      | { readonly status: "succeeded" }
      | { readonly status: "failed"; readonly error: AppError };
    try {
      await publication.publishHostListingChanged({ ...command, scope });
      publicationResult = { status: "succeeded" };
    } catch (error) {
      publicationResult = {
        status: "failed",
        error: normalizeHttpError(error),
      };
    }

    return isCurrent(scope)
      ? { ...command, status: "applied", publication: publicationResult }
      : {
          ...command,
          status: "applied-stale",
          publication: publicationResult,
        };
  };

  const start = (
    command: HostListingManagementCommand,
    scope: AuthenticatedSessionScope,
  ): Promise<HostListingManagementResult> => {
    const controller = new AbortController();
    activeController = controller;
    const promise = runCommand(command, scope, controller);
    activePromise = promise;

    void promise.then((result) => {
      if (
        result.status === "ambiguous" ||
        result.status === "applied-stale" ||
        (result.status === "applied" && result.publication.status === "failed")
      ) {
        terminalPromises.set(commandKey(command), promise);
      }
      if (activePromise === promise) activePromise = null;
      if (activeController === controller) activeController = null;
    });

    return promise;
  };

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      activeController?.abort();
      disposedPromise = activePromise ?? disposedPromise;
    },

    execute(command) {
      if (activePromise) return activePromise;
      if (disposed) return disposedPromise;
      if (!isPositiveSafeInteger(command.accommodationId)) {
        return Promise.resolve(invalidCommandResult());
      }

      const terminalPromise = terminalPromises.get(commandKey(command));
      if (terminalPromise) return terminalPromise;

      const scope = session.captureAuthenticatedSession();
      if (scope === null) return Promise.resolve(authenticationFailure());
      return start({ ...command }, scope);
    },
  };
};
