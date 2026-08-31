import { QueryClient } from "@tanstack/react-query";
import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../platform/query/sessionScope";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import { reviewReadQueryKeys } from "../queries/queryKeys";
import { createReviewCache } from "./reviewCache";

const scopeA: AuthenticatedSessionScope = {
  subject: "subject:member_a" as SessionSubject,
  epoch: 3,
};
const scopeB: AuthenticatedSessionScope = {
  subject: "subject:member_b" as SessionSubject,
  epoch: 4,
};

const seed = (
  client: QueryClient,
  scope: SessionQueryScope,
  accommodationId: number,
) => {
  const key = reviewReadQueryKeys.accommodation(
    scope,
    accommodationId,
    "LATEST",
    6,
  );
  client.setQueryDefaults(key, { meta: createSessionQueryMeta(scope) });
  client.setQueryData(key, {
    reviews: [],
    pageInfo: { currentSize: 0, hasNext: false, nextCursor: null },
  });
  return key;
};

describe("review cache publication", () => {
  it("invalidates only the created review's accommodation and captured session", async () => {
    const client = new QueryClient();
    const target = seed(client, scopeA, 31);
    const otherAccommodation = seed(client, scopeA, 32);
    const otherSession = seed(client, scopeB, 31);
    const anonymousSession = seed(client, { epoch: 5, subject: null }, 31);

    await createReviewCache(client).reviewCreated({
      accommodationId: 31,
      scope: scopeA,
    });

    expect(client.getQueryState(target)?.isInvalidated).toBe(true);
    expect(client.getQueryState(otherAccommodation)?.isInvalidated).toBe(false);
    expect(client.getQueryState(otherSession)?.isInvalidated).toBe(false);
    expect(client.getQueryState(anonymousSession)?.isInvalidated).toBe(false);
  });
});
