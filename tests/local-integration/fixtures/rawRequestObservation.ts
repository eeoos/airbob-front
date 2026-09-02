import { createHash } from "node:crypto";
import type { Page, Request } from "@playwright/test";

export interface ObservedLocalApiRequest {
  readonly method: string;
  readonly pathname: string;
  readonly queryNames: readonly string[];
  readonly contentType: string | null;
  readonly hasAuthorization: boolean;
  readonly hasCookie: boolean;
  readonly idempotencyKeyFingerprint: string | null;
  readonly postDataFingerprint: string | null;
}

export interface LocalApiRequestObservation {
  readonly requests: readonly ObservedLocalApiRequest[];
  settle(): Promise<void>;
  stop(): Promise<void>;
}

const fingerprint = (value: string | null): string | null =>
  value === null
    ? null
    : createHash("sha256").update(value).digest("hex").slice(0, 16);

const identifierOwners = new Set([
  "payment-attempts",
  "payment-operations",
  "reservations",
]);

const staticResourceSegments = new Set([
  "accommodations",
  "availability",
  "hold",
  "images",
  "issue",
  "payment-attempts",
  "publish",
  "reviews",
  "unpublish",
]);

const uuidSegmentPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isIdentifierSegment = (
  segment: string,
  previousSegment: string,
): boolean =>
  /^\d+$/.test(segment) ||
  uuidSegmentPattern.test(segment) ||
  (identifierOwners.has(previousSegment) &&
    segment.length > 0 &&
    !staticResourceSegments.has(segment));

const templatePathname = (pathname: string): string => {
  const segments = pathname.split("/");
  return segments
    .map((segment, index) =>
      index > 0 && isIdentifierSegment(segment, segments[index - 1] ?? "")
        ? ":id"
        : segment,
    )
    .join("/");
};

const captureRequest = async (
  request: Request,
  url: URL,
): Promise<ObservedLocalApiRequest> => {
  const [authorization, contentType, cookie, idempotencyKey] =
    await Promise.all([
      request.headerValue("authorization"),
      request.headerValue("content-type"),
      request.headerValue("cookie"),
      request.headerValue("idempotency-key"),
    ]);
  return Object.freeze({
    method: request.method(),
    pathname: templatePathname(url.pathname),
    queryNames: Object.freeze([...new Set(url.searchParams.keys())].sort()),
    contentType,
    hasAuthorization: authorization !== null,
    hasCookie: cookie !== null,
    idempotencyKeyFingerprint: fingerprint(idempotencyKey),
    postDataFingerprint: fingerprint(request.postData()),
  });
};

/**
 * Observe the browser's real same-origin `/api/v1` traffic without routing,
 * mocking, altering time, or retaining identifier, credential, header, query,
 * or body values.
 */
export const observeLocalApiRequests = (
  page: Page,
): LocalApiRequestObservation => {
  const requests: Array<ObservedLocalApiRequest | null> = [];
  const pendingCaptures: Array<Promise<void>> = [];
  const onRequest = (request: Request): void => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/v1/")) return;

    const requestIndex = requests.push(null) - 1;
    pendingCaptures.push(
      captureRequest(request, url).then((observation) => {
        requests[requestIndex] = observation;
      }),
    );
  };

  const settle = async (): Promise<void> => {
    while (pendingCaptures.length > 0) {
      await Promise.all(pendingCaptures.splice(0));
    }
  };

  page.on("request", onRequest);

  return {
    get requests() {
      return Object.freeze(
        requests.filter(
          (request): request is ObservedLocalApiRequest => request !== null,
        ),
      );
    },
    settle,
    async stop() {
      page.off("request", onRequest);
      await settle();
    },
  };
};
