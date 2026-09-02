import { expect, test, type Page, type Request } from "@playwright/test";
import { observeLocalApiRequests } from "../../local-integration/fixtures/rawRequestObservation";

type RequestListener = (request: Request) => void;

const createRequest = ({
  headers = {},
  method = "GET",
  postData = null,
  url,
}: {
  readonly headers?: Readonly<Record<string, string>>;
  readonly method?: string;
  readonly postData?: string | null;
  readonly url: string;
}): Request => {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );

  return {
    headerValue: async (name: string) =>
      normalizedHeaders.get(name.toLowerCase()) ?? null,
    method: () => method,
    postData: () => postData,
    url: () => url,
  } as unknown as Request;
};

const captureRequests = async (
  ...requests: Request[]
): Promise<ReturnType<typeof observeLocalApiRequests>["requests"]> => {
  let requestListener: RequestListener | undefined;
  const observation = observeLocalApiRequests({
    on: (_event: "request", listener: RequestListener) => {
      requestListener = listener;
    },
    off: () => {
      requestListener = undefined;
    },
  } as unknown as Page);

  for (const request of requests) requestListener?.(request);
  await observation.stop();

  return observation.requests;
};

const expectRawValuesNotRetained = (
  observation: unknown,
  ...rawValues: string[]
): void => {
  const serializedObservation = JSON.stringify(observation);
  for (const rawValue of rawValues) {
    expect(serializedObservation).not.toContain(rawValue);
  }
};

test("templates numeric and UUID path identifiers without retaining them", async () => {
  const numericId = "742991";
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  const requests = await captureRequests(
    createRequest({
      url: `http://127.0.0.1:3000/api/v1/accommodations/${numericId}/reviews`,
    }),
    createRequest({
      url: `http://127.0.0.1:3000/api/v1/users/${uuid}/profile`,
    }),
  );

  expect(requests.map(({ pathname }) => pathname)).toEqual([
    "/api/v1/accommodations/:id/reviews",
    "/api/v1/users/:id/profile",
  ]);
  expectRawValuesNotRetained(requests, numericId, uuid);
});

test("templates opaque identifiers only beneath their owning resources", async () => {
  const opaqueId = "operation_live_A7xQ9";
  const [request] = await captureRequests(
    createRequest({
      url: `http://127.0.0.1:3000/api/v1/payment-operations/${opaqueId}`,
    }),
  );

  expect(request?.pathname).toBe("/api/v1/payment-operations/:id");
  expectRawValuesNotRetained(request, opaqueId);
});

test("keeps recognized owner subresources static", async () => {
  const [request] = await captureRequests(
    createRequest({
      url: "http://127.0.0.1:3000/api/v1/payment-attempts/issue",
    }),
  );

  expect(request?.pathname).toBe("/api/v1/payment-attempts/issue");
});

test("captures sorted unique query names without retaining query values", async () => {
  const queryValues = [
    "private-zeta-value",
    "private-alpha-value",
    "private-second-zeta-value",
    "private-beta-value",
  ];
  const [request] = await captureRequests(
    createRequest({
      url:
        "http://127.0.0.1:3000/api/v1/search" +
        `?zeta=${queryValues[0]}&alpha=${queryValues[1]}` +
        `&zeta=${queryValues[2]}&beta=${queryValues[3]}`,
    }),
  );

  expect(request?.queryNames).toEqual(["alpha", "beta", "zeta"]);
  expectRawValuesNotRetained(request, ...queryValues);
});

test("records authorization and cookie presence without retaining values", async () => {
  const authorization = "Bearer private-access-token";
  const cookie = "session=private-session-cookie";
  const requests = await captureRequests(
    createRequest({
      headers: { authorization, cookie },
      url: "http://127.0.0.1:3000/api/v1/session",
    }),
    createRequest({
      url: "http://127.0.0.1:3000/api/v1/profile",
    }),
  );

  expect(
    requests.map(({ hasAuthorization, hasCookie }) => ({
      hasAuthorization,
      hasCookie,
    })),
  ).toEqual([
    { hasAuthorization: true, hasCookie: true },
    { hasAuthorization: false, hasCookie: false },
  ]);
  expectRawValuesNotRetained(requests, authorization, cookie);
});

test("fingerprints idempotency keys and bodies without retaining raw values", async () => {
  const idempotencyKey = "idempotency-key-private-value";
  const postData = '{"paymentKey":"private-payment-key","amount":125000}';
  const [request] = await captureRequests(
    createRequest({
      headers: { "idempotency-key": idempotencyKey },
      method: "POST",
      postData,
      url: "http://127.0.0.1:3000/api/v1/payment-attempts",
    }),
  );

  expect(request?.idempotencyKeyFingerprint).toBe("40406b02ec4e1fb5");
  expect(request?.postDataFingerprint).toBe("03f778e419f5b306");
  expectRawValuesNotRetained(
    request,
    idempotencyKey,
    postData,
    "private-payment-key",
  );
});
