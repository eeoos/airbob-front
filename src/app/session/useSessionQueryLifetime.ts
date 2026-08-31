import { QueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { createQueryClient } from "../../platform/query/createQueryClient";
import {
  createSessionQueryMeta,
  setQueryClientSessionScope,
  type SessionQueryScope,
} from "../../platform/query/sessionScope";
import { toAuthenticatedSessionScope, type SessionState } from "./sessionState";

export type { SessionQueryScope } from "../../platform/query/sessionScope";

export interface SessionQueryGeneration extends SessionQueryScope {
  readonly client: QueryClient;
  readonly fenceId: number;
  readonly owned: boolean;
  readonly tainted: boolean;
}

export type SessionQueryClientFactory = (
  scope: SessionQueryScope,
) => QueryClient;

interface UseSessionQueryLifetimeOptions {
  readonly initialQueryClient?: QueryClient;
  readonly initialState: SessionState;
  readonly queryClientFactory?: SessionQueryClientFactory;
}

interface ReplaceSessionQueryGenerationOptions extends SessionQueryScope {
  readonly isStillCurrent: () => boolean;
  readonly tainted?: boolean;
}

interface ResetSessionQueryGenerationOptions extends SessionQueryScope {
  readonly isStillCurrent: () => boolean;
}

const defaultQueryClientFactory: SessionQueryClientFactory = (scope) => {
  const sessionMeta = createSessionQueryMeta(scope);

  return createQueryClient({
    defaultOptions: {
      queries: { meta: sessionMeta },
      mutations: { meta: sessionMeta },
    },
  });
};

const disposeQueryClient = async (client: QueryClient) => {
  try {
    await client.cancelQueries();
  } catch {
    // A failed cancellation cannot retain identity-owned cache entries.
  }
  client.clear();
};

export const useSessionQueryLifetime = ({
  initialQueryClient,
  initialState,
  queryClientFactory = defaultQueryClientFactory,
}: UseSessionQueryLifetimeOptions) => {
  const initialGenerationRef = useRef<SessionQueryGeneration | null>(null);

  if (initialGenerationRef.current === null) {
    const initialScope = toAuthenticatedSessionScope(initialState);
    const scope = {
      epoch: initialState.epoch,
      subject: initialScope?.subject ?? null,
    };
    const client = initialQueryClient ?? queryClientFactory(scope);
    if (initialQueryClient) {
      setQueryClientSessionScope(client, scope);
    }

    initialGenerationRef.current = {
      client,
      epoch: initialState.epoch,
      fenceId: 0,
      subject: scope.subject,
      tainted: false,
      owned: initialQueryClient === undefined,
    };
  }

  const [generation, setGeneration] = useState(initialGenerationRef.current);
  const generationRef = useRef(generation);
  const lifetimeTokenRef = useRef(0);
  generationRef.current = generation;

  const getCurrentGeneration = useCallback(() => generationRef.current, []);

  const replaceQueryGeneration = useCallback(
    async ({
      epoch,
      isStillCurrent,
      subject,
      tainted = false,
    }: ReplaceSessionQueryGenerationOptions) => {
      lifetimeTokenRef.current += 1;
      const previous = generationRef.current;
      const next: SessionQueryGeneration = {
        client: queryClientFactory({ epoch, subject }),
        epoch,
        fenceId: previous.fenceId + 1,
        subject,
        tainted,
        owned: true,
      };

      generationRef.current = next;
      setGeneration(next);

      await disposeQueryClient(previous.client);

      return isStillCurrent();
    },
    [queryClientFactory],
  );

  const resetQueryGeneration = useCallback(
    async ({
      epoch,
      isStillCurrent,
      subject,
    }: ResetSessionQueryGenerationOptions) => {
      const token = ++lifetimeTokenRef.current;
      const current = generationRef.current;
      const next: SessionQueryGeneration = {
        ...current,
        epoch,
        subject,
        tainted: true,
      };

      setQueryClientSessionScope(current.client, next);
      generationRef.current = next;
      setGeneration(next);

      try {
        await current.client.cancelQueries();
      } catch {
        // A failed cancellation cannot retain identity-owned cache entries.
      }

      if (
        lifetimeTokenRef.current !== token ||
        generationRef.current.client !== current.client ||
        !isStillCurrent()
      ) {
        return false;
      }

      current.client.clear();
      return true;
    },
    [],
  );

  const stabilizeQueryGeneration = useCallback(
    ({
      epoch,
      isStillCurrent,
      subject,
    }: ResetSessionQueryGenerationOptions) => {
      if (!isStillCurrent()) return false;

      lifetimeTokenRef.current += 1;
      const current = generationRef.current;
      const next: SessionQueryGeneration = {
        ...current,
        epoch,
        subject,
        tainted: false,
      };

      setQueryClientSessionScope(current.client, next);
      generationRef.current = next;
      setGeneration(next);
      return isStillCurrent();
    },
    [],
  );

  const disposeCurrentGeneration = useCallback(async () => {
    lifetimeTokenRef.current += 1;
    const current = generationRef.current;
    if (!current.owned) return;

    await disposeQueryClient(current.client);
  }, []);

  return {
    disposeCurrentGeneration,
    generation,
    getCurrentGeneration,
    replaceQueryGeneration,
    resetQueryGeneration,
    stabilizeQueryGeneration,
  };
};
