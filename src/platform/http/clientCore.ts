import { HttpTransportFailure } from "./transportFailure";

const API_REQUEST_TIMEOUT_MS = 30_000;
const MULTIPART_API_REQUEST_TIMEOUT_MS = 5 * 60_000;

type HttpQueryPrimitive = boolean | number | string;
type HttpQueryValue =
  HttpQueryPrimitive | readonly HttpQueryPrimitive[] | null | undefined;

export interface HttpClientRequest {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly path: string;
  readonly body?: unknown;
  readonly bodyEncoding?: "multipart";
  readonly params?: object;
  readonly signal?: AbortSignal | undefined;
  readonly onUploadProgress?: (progress: number) => void;
}

export interface HttpClientResponse {
  readonly contentType: string | null;
  readonly data: unknown;
  readonly status: number;
}

export interface BrowserHttpClient {
  request(request: HttpClientRequest): Promise<HttpClientResponse>;
}

interface BrowserHttpClientDependencies {
  readonly baseUrl: string;
  readonly createRequest: () => XMLHttpRequest;
  readonly fetchRequest: typeof globalThis.fetch;
}

interface AbortLease {
  readonly didTimeout: () => boolean;
  readonly release: () => void;
  readonly signal: AbortSignal;
}

const createAbortLease = (
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): AbortLease => {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    didTimeout: () => timedOut,
    release: () => {
      globalThis.clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    },
    signal: controller.signal,
  };
};

const isQueryPrimitive = (value: unknown): value is HttpQueryPrimitive =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const appendQueryValue = (
  searchParams: URLSearchParams,
  key: string,
  value: unknown,
) => {
  if (!isQueryPrimitive(value)) {
    throw new HttpTransportFailure("configuration");
  }

  searchParams.append(key, String(value));
};

const serializeQuery = (params: object | undefined): string => {
  if (params === undefined) {
    return "";
  }

  const searchParams = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params) as [
    string,
    HttpQueryValue,
  ][]) {
    if (rawValue === null || rawValue === undefined) {
      continue;
    }

    if (Array.isArray(rawValue)) {
      rawValue.forEach((value) =>
        appendQueryValue(searchParams, `${key}[]`, value),
      );
      continue;
    }

    appendQueryValue(searchParams, key, rawValue);
  }

  return searchParams.toString().replaceAll("%5B%5D", "[]");
};

const createRequestUrl = (
  baseUrl: string,
  path: string,
  params: object | undefined,
): string => {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new HttpTransportFailure("configuration");
  }

  const query = serializeQuery(params);
  const requestUrl = `${baseUrl.replace(/\/+$/u, "")}${path}`;
  return query ? `${requestUrl}?${query}` : requestUrl;
};

const parseResponseText = (text: string): unknown => {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const requestTimeoutFor = (request: HttpClientRequest): number =>
  request.bodyEncoding === "multipart"
    ? MULTIPART_API_REQUEST_TIMEOUT_MS
    : API_REQUEST_TIMEOUT_MS;

const requestBodyFor = (request: HttpClientRequest): BodyInit | undefined => {
  if (request.bodyEncoding === "multipart") {
    if (!(request.body instanceof FormData)) {
      throw new HttpTransportFailure("configuration");
    }

    return request.body;
  }

  return request.body === undefined ? undefined : JSON.stringify(request.body);
};

const requestHeadersFor = (request: HttpClientRequest): HeadersInit => ({
  Accept: "application/json",
  ...(request.body === undefined || request.bodyEncoding === "multipart"
    ? {}
    : { "Content-Type": "application/json" }),
});

const assertSuccessfulResponse = (
  status: number,
  responseData: unknown,
): void => {
  if (status < 200 || status >= 300) {
    throw new HttpTransportFailure("http", { responseData, status });
  }
};

const sendFetchRequest = async (
  fetchRequest: typeof globalThis.fetch,
  url: string,
  request: HttpClientRequest,
): Promise<HttpClientResponse> => {
  const abortLease = createAbortLease(
    request.signal,
    requestTimeoutFor(request),
  );

  try {
    const body = requestBodyFor(request);
    const response = await fetchRequest(url, {
      ...(body === undefined ? {} : { body }),
      credentials: "include",
      headers: requestHeadersFor(request),
      method: request.method,
      signal: abortLease.signal,
    });
    const data = parseResponseText(await response.text());

    assertSuccessfulResponse(response.status, data);
    return {
      contentType: response.headers.get("content-type"),
      data,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof HttpTransportFailure) {
      throw error;
    }
    if (abortLease.didTimeout()) {
      throw new HttpTransportFailure("timeout", { cause: error });
    }
    if (request.signal?.aborted || abortLease.signal.aborted) {
      throw new HttpTransportFailure("cancelled", { cause: error });
    }

    throw new HttpTransportFailure("network", { cause: error });
  } finally {
    abortLease.release();
  }
};

const sendMultipartProgressRequest = (
  createRequest: () => XMLHttpRequest,
  url: string,
  request: HttpClientRequest,
): Promise<HttpClientResponse> => {
  const body = requestBodyFor(request);
  if (!(body instanceof FormData)) {
    throw new HttpTransportFailure("configuration");
  }
  if (request.signal?.aborted) {
    throw new HttpTransportFailure("cancelled");
  }

  return new Promise((resolve, reject) => {
    let browserRequest: XMLHttpRequest;

    try {
      browserRequest = createRequest();
    } catch (error) {
      reject(new HttpTransportFailure("network", { cause: error }));
      return;
    }

    let settled = false;
    const abortFromCaller = () => browserRequest.abort();
    const release = () => {
      request.signal?.removeEventListener("abort", abortFromCaller);
      browserRequest.onload = null;
      browserRequest.onerror = null;
      browserRequest.onabort = null;
      browserRequest.ontimeout = null;
      browserRequest.upload.onprogress = null;
    };
    const settle = (complete: () => void) => {
      if (settled) return;
      settled = true;
      release();
      complete();
    };
    const rejectWith = (failure: HttpTransportFailure) =>
      settle(() => reject(failure));

    try {
      browserRequest.open(request.method, url);
      browserRequest.withCredentials = true;
      browserRequest.timeout = requestTimeoutFor(request);
      browserRequest.setRequestHeader("Accept", "application/json");
      browserRequest.upload.onprogress = ({
        lengthComputable,
        loaded,
        total,
      }) => {
        if (lengthComputable && total > 0) {
          request.onUploadProgress?.(Math.round((loaded * 100) / total));
        }
      };
      browserRequest.onload = () => {
        const data = parseResponseText(browserRequest.responseText);

        try {
          assertSuccessfulResponse(browserRequest.status, data);
          settle(() =>
            resolve({
              contentType: browserRequest.getResponseHeader("content-type"),
              data,
              status: browserRequest.status,
            }),
          );
        } catch (error) {
          rejectWith(
            error instanceof HttpTransportFailure
              ? error
              : new HttpTransportFailure("network", { cause: error }),
          );
        }
      };
      browserRequest.onerror = () =>
        rejectWith(new HttpTransportFailure("network"));
      browserRequest.onabort = () =>
        rejectWith(new HttpTransportFailure("cancelled"));
      browserRequest.ontimeout = () =>
        rejectWith(new HttpTransportFailure("timeout"));
      request.signal?.addEventListener("abort", abortFromCaller, {
        once: true,
      });

      browserRequest.send(body);
    } catch (error) {
      rejectWith(new HttpTransportFailure("network", { cause: error }));
    }
  });
};

export const createBrowserHttpClient = ({
  baseUrl,
  createRequest,
  fetchRequest,
}: BrowserHttpClientDependencies): BrowserHttpClient => ({
  request(request) {
    const url = createRequestUrl(baseUrl, request.path, request.params);

    return request.bodyEncoding === "multipart" && request.onUploadProgress
      ? sendMultipartProgressRequest(createRequest, url, request)
      : sendFetchRequest(fetchRequest, url, request);
  },
});
