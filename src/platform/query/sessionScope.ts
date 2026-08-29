import type { QueryClient } from "@tanstack/react-query";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../session/sessionScope";

export interface SessionQueryScope {
  readonly epoch: number;
  readonly subject: SessionSubject | null;
}

export const createSessionQueryMeta = (scope: SessionQueryScope) =>
  Object.freeze({
    session: Object.freeze({
      epoch: scope.epoch,
      subject: scope.subject,
    }),
  });

export type SessionQueryMeta = ReturnType<typeof createSessionQueryMeta>;

export const withSessionScopeKey = <TBaseParts extends readonly unknown[]>(
  scope: AuthenticatedSessionScope,
  baseParts: TBaseParts,
): readonly [...TBaseParts, SessionQueryMeta] =>
  Object.freeze([
    ...baseParts,
    createSessionQueryMeta(scope),
  ]) as unknown as readonly [...TBaseParts, SessionQueryMeta];

export const setQueryClientSessionScope = (
  client: QueryClient,
  scope: SessionQueryScope,
) => {
  const defaults = client.getDefaultOptions();
  const sessionMeta = createSessionQueryMeta(scope);

  client.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, meta: sessionMeta },
    mutations: { ...defaults.mutations, meta: sessionMeta },
  });
};
