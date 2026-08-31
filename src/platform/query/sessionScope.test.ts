import { QueryClient } from "@tanstack/react-query";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../session/sessionScope";
import {
  createSessionQueryMeta,
  matchesSessionQueryScope,
  setQueryClientSessionScope,
  withSessionScopeKey,
} from "./sessionScope";

const scope: AuthenticatedSessionScope = {
  subject: "subject:member_1" as SessionSubject,
  epoch: 7,
};

describe("session-scoped query contracts", () => {
  it("creates deeply frozen non-PII query metadata", () => {
    const meta = createSessionQueryMeta(scope);

    expect(meta).toEqual({ session: scope });
    expect(Object.isFrozen(meta)).toBe(true);
    expect(Object.isFrozen(meta.session)).toBe(true);
    expect(meta).not.toHaveProperty("viewer");
    expect(meta).not.toHaveProperty("email");
  });

  it("appends one stable scope suffix without redefining the resource key", () => {
    const key = withSessionScopeKey(scope, ["wishlist", "lists"] as const);

    expect(key).toEqual([
      "wishlist",
      "lists",
      { session: { subject: scope.subject, epoch: 7 } },
    ]);
    expect(Object.isFrozen(key)).toBe(true);
    expect(Object.isFrozen(key[2])).toBe(true);
    expect(Object.isFrozen(key[2].session)).toBe(true);
  });

  it("matches only exact session query metadata", () => {
    const meta = createSessionQueryMeta(scope);

    expect(matchesSessionQueryScope(meta, scope)).toBe(true);
    expect(matchesSessionQueryScope(meta, { ...scope, epoch: 8 })).toBe(false);
    expect(matchesSessionQueryScope(meta, { ...scope, subject: null })).toBe(
      false,
    );
    expect(matchesSessionQueryScope(null, scope)).toBe(false);
    expect(matchesSessionQueryScope({ session: null }, scope)).toBe(false);
  });

  it("updates query and mutation defaults without dropping existing policy", () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 1_000 },
        mutations: { retry: false },
      },
    });

    setQueryClientSessionScope(client, { epoch: 8, subject: null });

    expect(client.getDefaultOptions().queries).toMatchObject({
      retry: false,
      staleTime: 1_000,
      meta: { session: { epoch: 8, subject: null } },
    });
    expect(client.getDefaultOptions().mutations).toMatchObject({
      retry: false,
      meta: { session: { epoch: 8, subject: null } },
    });
  });
});
