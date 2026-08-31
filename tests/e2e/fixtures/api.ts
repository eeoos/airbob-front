import type { BrowserContext, Request, Route } from "@playwright/test";
import { E2E_API_ORIGIN } from "../support/runtimeOrigins";

export type PathMatcher = string | RegExp;

export interface ApiRequestRecord {
  readonly sequence: number;
  readonly method: string;
  readonly pathname: string;
  readonly query: ReadonlyArray<readonly [string, string]>;
  readonly body: unknown;
}

export interface ApiErrorBody {
  message: string;
  status: number;
  code: string;
  errors?: Array<{
    field: string;
    value: string;
    reason: string;
  }>;
}

export interface ApiResponseSpec {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

type ApiHandler = (
  request: ApiRequestRecord,
) => ApiResponseSpec | Promise<ApiResponseSpec>;

interface RegisteredHandler {
  method: string;
  matcher: PathMatcher;
  handler: ApiHandler;
}

interface UnhandledRequest {
  method: string;
  target: string;
  kind:
    | "api"
    | "external"
    | "same-origin-data"
    | "external-websocket"
    | "same-origin-websocket";
}

const API_PATH = "/api";
const E2E_API_ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);
const E2E_API_ALLOWED_APP_HEADERS = new Set(["accept", "content-type"]);
const BROWSER_MANAGED_HEADERS = new Set([
  "accept-encoding",
  "accept-language",
  "connection",
  "content-length",
  "cookie",
  "host",
  "origin",
  "priority",
  "referer",
  "user-agent",
]);
const E2E_API_ALLOWED_ACCEPT_VALUES = new Set([
  "*/*",
  "application/json",
  "application/json, text/plain, */*",
]);
const DAUM_POSTCODE_HOST = "t1.daumcdn.net";
const DAUM_POSTCODE_PATH = "/mapjsapi/bundle/postcode/prod/postcode.v2.js";
const DAUM_POSTCODE_ORIGIN = `https://${DAUM_POSTCODE_HOST}`;
const SAFE_STATIC_RESOURCE_TYPES = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "stylesheet",
]);
const SAFE_PUBLIC_ASSET_PATHS = new Set([
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
  "/manifest.json",
  "/robots.txt",
]);

const parseBody = (request: Request): unknown => {
  const rawBody = request.postData();

  if (rawBody === null) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
};

const matchesPath = (matcher: PathMatcher, pathname: string): boolean => {
  if (typeof matcher === "string") {
    return matcher === pathname;
  }

  matcher.lastIndex = 0;
  return matcher.test(pathname);
};

export const isExactE2eApiUrl = (url: URL): boolean =>
  url.origin === E2E_API_ORIGIN && !url.username && !url.password;

export const apiSuccess = <T>(data: T, status = 200): ApiResponseSpec => ({
  status,
  body: {
    success: true,
    data,
    error: null,
  },
});

export const apiFailure = (
  status: number,
  code: string,
  message: string,
): ApiResponseSpec => ({
  status,
  body: {
    success: false,
    data: null,
    error: {
      message,
      status,
      code,
    } satisfies ApiErrorBody,
  },
});

export class ApiHarness {
  readonly requests: ApiRequestRecord[] = [];

  private readonly handlers: RegisteredHandler[] = [];
  private readonly unhandled: UnhandledRequest[] = [];
  private sequence = 0;
  private readonly appHost: string;

  constructor(
    private readonly context: BrowserContext,
    private readonly appOrigin: string,
  ) {
    this.appHost = new URL(appOrigin).host;
  }

  register(
    method: string,
    matcher: PathMatcher,
    response: ApiResponseSpec | ApiHandler,
  ): void {
    this.handlers.push({
      method: method.toUpperCase(),
      matcher,
      handler: typeof response === "function" ? response : () => response,
    });
  }

  matching(method: string, matcher: PathMatcher): ApiRequestRecord[] {
    const normalizedMethod = method.toUpperCase();

    return this.requests.filter(
      (request) =>
        request.method === normalizedMethod &&
        matchesPath(matcher, request.pathname),
    );
  }

  async install(): Promise<void> {
    await this.context.route("**/*", async (route) => {
      await this.handleRoute(route);
    });
    await this.context.routeWebSocket(/.*/, async (webSocket) => {
      const url = new URL(webSocket.url());

      this.unhandled.push({
        method: "WEBSOCKET",
        target: `${url.host}${url.pathname}`,
        kind:
          url.host === this.appHost
            ? "same-origin-websocket"
            : "external-websocket",
      });
      await webSocket.close({ code: 1008, reason: "Blocked by E2E harness" });
    });
  }

  assertNoUnhandledRequests(): void {
    if (this.unhandled.length === 0) {
      return;
    }

    const summary = this.unhandled
      .map(({ method, target, kind }) => `${method} ${target} (${kind})`)
      .join("\n");

    throw new Error(`Unhandled browser network request(s):\n${summary}`);
  }

  private async handleRoute(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const hasUrlCredentials = Boolean(url.username || url.password);
    const isSameOrigin =
      url.origin === this.appOrigin && !hasUrlCredentials;
    const isE2eApiOrigin = isExactE2eApiUrl(url);
    const isApiPath =
      url.pathname === API_PATH || url.pathname.startsWith(`${API_PATH}/`);

    // Production E2E must exercise the configured cross-origin API boundary.
    // Never let a relative /api regression fall through to registered mocks,
    // because that would make a broken runtime API origin look healthy.
    if (isSameOrigin && isApiPath) {
      this.recordUnhandled(method, url, "api");
      await route.abort("blockedbyclient");
      return;
    }

    if (isE2eApiOrigin && isApiPath) {
      if (
        !this.hasExactAppOrigin(request) ||
        !this.isAllowedExternalApiRequest(request, method)
      ) {
        this.recordUnhandled(method, url, "api");
        await route.abort("blockedbyclient");
        return;
      }

      await this.handleApiRequest(
        route,
        request,
        method,
        url,
        true,
      );
      return;
    }

    if (
      method === "GET" &&
      request.resourceType() === "script" &&
      url.href === `${DAUM_POSTCODE_ORIGIN}${DAUM_POSTCODE_PATH}`
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: `
          (() => {
            const syntheticResult = Object.freeze({
              zonecode: "06236",
              address: "서울특별시 강남구 테헤란로 123",
              addressEnglish: "",
              addressType: "R",
              bname: "",
              buildingName: "",
              apartment: "",
              sido: "서울특별시",
              sigungu: "강남구",
              sigunguCode: "",
              bcode: "",
              roadname: "테헤란로",
              roadnameCode: "",
              jibunAddress: "",
              roadAddress: "서울특별시 강남구 테헤란로 123"
            });

            window.daum = {
              Postcode: function Postcode(options) {
                this.open = () => options.oncomplete(syntheticResult);
                this.embed = () => undefined;
              }
            };
          })();
        `,
      });
      return;
    }

    const isSafeDocumentRequest = request.resourceType() === "document";
    const isSafeStaticRequest =
      SAFE_STATIC_RESOURCE_TYPES.has(request.resourceType()) &&
      (url.pathname.startsWith("/static/") ||
        SAFE_PUBLIC_ASSET_PATHS.has(url.pathname));

    if (
      isSameOrigin &&
      (method === "GET" || method === "HEAD") &&
      (isSafeDocumentRequest || isSafeStaticRequest)
    ) {
      await route.continue();
      return;
    }

    this.unhandled.push({
      method,
      target: isSameOrigin
        ? url.pathname
        : `${url.host}${url.pathname}`,
      kind: isSameOrigin ? "same-origin-data" : "external",
    });
    await route.abort("blockedbyclient");
  }

  private async handleApiRequest(
    route: Route,
    request: Request,
    method: string,
    url: URL,
    isCrossOrigin: boolean,
  ): Promise<void> {
    const record: ApiRequestRecord = {
      sequence: ++this.sequence,
      method,
      pathname: url.pathname,
      query: Array.from(url.searchParams.entries()),
      body: parseBody(request),
    };
    this.requests.push(record);

    const registration = [...this.handlers]
      .reverse()
      .find(
        (candidate) =>
          candidate.method === method &&
          matchesPath(candidate.matcher, url.pathname),
      );

    if (!registration) {
      this.recordUnhandled(method, url, "api");
      await route.fulfill({
        status: 599,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...(isCrossOrigin ? this.corsResponseHeaders() : {}),
        },
        body: JSON.stringify(
          apiFailure(599, "UNHANDLED_E2E_REQUEST", "등록되지 않은 테스트 요청입니다.")
            .body,
        ),
      });
      return;
    }

    const response = await registration.handler(record);
    await route.fulfill({
      status: response.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...response.headers,
        ...(isCrossOrigin ? this.corsResponseHeaders() : {}),
      },
      body: JSON.stringify(response.body),
    });
  }

  private hasExactAppOrigin(request: Request): boolean {
    return request.headers().origin === this.appOrigin;
  }

  /**
   * Chromium's Playwright interception layer answers CORS preflights before a
   * user route is invoked. Enforce the executable boundary on the resulting
   * actual request so an auto-approved custom header or method can never reach
   * a registered handler or the request journal.
   */
  private isAllowedExternalApiRequest(
    request: Request,
    method: string,
  ): boolean {
    if (!E2E_API_ALLOWED_METHODS.has(method)) {
      return false;
    }

    const headers = request.headers();
    const hasUnexpectedHeader = Object.keys(headers).some((header) => {
      const normalizedHeader = header.toLowerCase();

      return (
        !E2E_API_ALLOWED_APP_HEADERS.has(normalizedHeader) &&
        !BROWSER_MANAGED_HEADERS.has(normalizedHeader) &&
        !normalizedHeader.startsWith("sec-")
      );
    });

    if (hasUnexpectedHeader) {
      return false;
    }

    const accept = headers.accept;
    if (accept && !E2E_API_ALLOWED_ACCEPT_VALUES.has(accept.toLowerCase())) {
      return false;
    }

    const contentType = headers["content-type"]?.toLowerCase();
    if (!contentType) {
      return true;
    }

    return (
      /^application\/json(?:\s*;\s*charset=utf-?8)?$/.test(contentType) ||
      /^multipart\/form-data;\s*boundary=[a-z0-9'()+_,./:=?-]+$/i.test(
        contentType,
      )
    );
  }

  private corsResponseHeaders(): Record<string, string> {
    return {
      "access-control-allow-credentials": "true",
      "access-control-allow-origin": this.appOrigin,
      vary: "Origin",
    };
  }

  private recordUnhandled(
    method: string,
    url: URL,
    kind: UnhandledRequest["kind"],
  ): void {
    this.unhandled.push({
      method,
      target: url.origin === this.appOrigin
        ? url.pathname
        : `${url.host}${url.pathname}`,
      kind,
    });
  }
}
