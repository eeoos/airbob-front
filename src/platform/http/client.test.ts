import type { HttpClientResponse } from "./client";
import { createBrowserHttpClient } from "./clientCore";
import { HttpTransportFailure } from "./transportFailure";

const successfulEnvelope = {
  success: true,
  data: { id: 1 },
  error: null,
};

const fetchResponse = ({
  contentType = "application/json;charset=utf-8",
  data = successfulEnvelope,
  status = 200,
}: {
  contentType?: string | null;
  data?: unknown;
  status?: number;
} = {}): Response =>
  ({
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? contentType : null,
    },
    status,
    text: async () => (typeof data === "string" ? data : JSON.stringify(data)),
  }) as Response;

const unusedRequestFactory = () => {
  throw new Error("XMLHttpRequest was not expected.");
};

type ProgressListener = ((event: ProgressEvent) => void) | null;

const createFakeRequest = () => ({
  abort: vi.fn(),
  getResponseHeader: vi.fn(() => "application/json"),
  onabort: null as (() => void) | null,
  onerror: null as (() => void) | null,
  onload: null as (() => void) | null,
  ontimeout: null as (() => void) | null,
  open: vi.fn(),
  responseText: JSON.stringify(successfulEnvelope),
  send: vi.fn(),
  setRequestHeader: vi.fn(),
  status: 200,
  timeout: 0,
  upload: { onprogress: null as ProgressListener },
  withCredentials: false,
});

const createClient = (fetchRequest: typeof globalThis.fetch) =>
  createBrowserHttpClient({
    baseUrl: "/api/v1",
    createRequest: unusedRequestFactory,
    fetchRequest,
  });

const createProgressClient = (request: ReturnType<typeof createFakeRequest>) =>
  createBrowserHttpClient({
    baseUrl: "/api/v1",
    createRequest: () => request as unknown as XMLHttpRequest,
    fetchRequest: unusedRequestFactory,
  });

const createMultipartBody = () => {
  const body = new FormData();
  body.append("images", new File(["image"], "stay.png"));
  return body;
};

describe("platform HTTP client", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses one credentialed JSON boundary and preserves the existing array query encoding", async () => {
    const fetchRequest = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => fetchResponse(),
    );
    const client = createClient(fetchRequest);

    const result = await client.request({
      method: "POST",
      path: "/search/accommodations",
      params: {
        amenityTypes: ["WIFI", "PARKING"],
        page: 2,
        omitted: undefined,
      },
      body: { destination: "서울" },
    });

    expect(result).toEqual<HttpClientResponse>({
      contentType: "application/json;charset=utf-8",
      data: successfulEnvelope,
      status: 200,
    });
    expect(fetchRequest).toHaveBeenCalledOnce();
    const [url, init] = fetchRequest.mock.calls[0] ?? [];
    expect(url).toBe(
      "/api/v1/search/accommodations?amenityTypes[]=WIFI&amenityTypes[]=PARKING&page=2",
    );
    expect(init).toMatchObject({
      body: JSON.stringify({ destination: "서울" }),
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects external paths and nested query values before network access", () => {
    const fetchRequest = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => fetchResponse(),
    );
    const client = createClient(fetchRequest);

    expect(() =>
      client.request({
        method: "GET",
        path: "https://external.example.invalid/listings",
      }),
    ).toThrow(HttpTransportFailure);
    expect(() =>
      client.request({
        method: "GET",
        path: "/listings",
        params: { nested: { unsafe: true } },
      }),
    ).toThrow(HttpTransportFailure);
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it("propagates caller cancellation through the owned AbortSignal", async () => {
    const fetchRequest = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("cancelled", "AbortError")),
            { once: true },
          );
        }),
    );
    const client = createClient(fetchRequest);
    const controller = new AbortController();
    const result = client
      .request({
        method: "GET",
        path: "/slow",
        signal: controller.signal,
      })
      .catch((error: unknown) => error);

    controller.abort();

    await expect(result).resolves.toMatchObject({
      name: "HttpTransportFailure",
      kind: "cancelled",
    });
  });

  it("turns the platform deadline into a retryable timeout category", async () => {
    vi.useFakeTimers();
    const fetchRequest = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("timed out", "AbortError")),
            { once: true },
          );
        }),
    );
    const client = createClient(fetchRequest);
    const result = client
      .request({ method: "GET", path: "/slow" })
      .catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toMatchObject({
      name: "HttpTransportFailure",
      kind: "timeout",
    });
  });

  it("keeps non-success response data out of serialization while retaining safe classification input", async () => {
    const responseData = {
      success: false,
      error: { code: "M004", token: "private-response-token" },
    };
    const client = createClient(
      vi.fn(async () => fetchResponse({ data: responseData, status: 403 })),
    );
    let failure: unknown;

    try {
      await client.request({ method: "GET", path: "/protected" });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(HttpTransportFailure);
    expect(failure).toMatchObject({ kind: "http", status: 403 });
    expect((failure as HttpTransportFailure).responseData).toEqual(
      responseData,
    );
    expect(JSON.stringify(failure)).not.toContain("private-response-token");
  });

  it("lets fetch own a multipart boundary when progress is not requested", async () => {
    const fetchRequest = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => fetchResponse(),
    );
    const client = createClient(fetchRequest);
    const body = new FormData();
    body.append("images", new File(["image"], "stay.png"));

    await client.request({
      method: "POST",
      path: "/reviews/1/images",
      body,
      bodyEncoding: "multipart",
    });

    const init = fetchRequest.mock.calls[0]?.[1];
    expect(init?.body).toBe(body);
    expect(new Headers(init?.headers).has("content-type")).toBe(false);
  });

  it("uses XMLHttpRequest only for multipart upload progress", async () => {
    const fakeRequest = createFakeRequest();
    fakeRequest.send.mockImplementation(() => {
      fakeRequest.upload.onprogress?.({
        lengthComputable: true,
        loaded: 1,
        total: 3,
      } as ProgressEvent);
      fakeRequest.upload.onprogress?.({
        lengthComputable: false,
        loaded: 2,
        total: 0,
      } as ProgressEvent);
      fakeRequest.onload?.();
    });
    const client = createProgressClient(fakeRequest);
    const body = createMultipartBody();
    const onUploadProgress = vi.fn();

    await client.request({
      method: "POST",
      path: "/accommodations/31/images",
      body,
      bodyEncoding: "multipart",
      onUploadProgress,
    });

    expect(fakeRequest.open).toHaveBeenCalledWith(
      "POST",
      "/api/v1/accommodations/31/images",
    );
    expect(fakeRequest.withCredentials).toBe(true);
    expect(fakeRequest.timeout).toBe(5 * 60_000);
    expect(fakeRequest.setRequestHeader).toHaveBeenCalledExactlyOnceWith(
      "Accept",
      "application/json",
    );
    expect(fakeRequest.send).toHaveBeenCalledWith(body);
    expect(onUploadProgress).toHaveBeenCalledExactlyOnceWith(33);
  });

  it("propagates caller cancellation through the progress-upload request and releases handlers", async () => {
    const fakeRequest = createFakeRequest();
    fakeRequest.abort.mockImplementation(() => fakeRequest.onabort?.());
    const client = createProgressClient(fakeRequest);
    const controller = new AbortController();
    const result = client
      .request({
        method: "POST",
        path: "/accommodations/31/images",
        body: createMultipartBody(),
        bodyEncoding: "multipart",
        onUploadProgress: vi.fn(),
        signal: controller.signal,
      })
      .catch((error: unknown) => error);

    controller.abort();

    await expect(result).resolves.toMatchObject({
      name: "HttpTransportFailure",
      kind: "cancelled",
    });
    expect(fakeRequest.abort).toHaveBeenCalledOnce();
    expect(fakeRequest.onload).toBeNull();
    expect(fakeRequest.onerror).toBeNull();
    expect(fakeRequest.onabort).toBeNull();
    expect(fakeRequest.ontimeout).toBeNull();
    expect(fakeRequest.upload.onprogress).toBeNull();
  });

  it.each([
    ["network", "error"],
    ["timeout", "timeout"],
  ] as const)(
    "normalizes an XMLHttpRequest %s terminal",
    async (expectedKind, terminal) => {
      const fakeRequest = createFakeRequest();
      fakeRequest.send.mockImplementation(() => {
        if (terminal === "error") fakeRequest.onerror?.();
        else fakeRequest.ontimeout?.();
      });
      const client = createProgressClient(fakeRequest);

      await expect(
        client.request({
          method: "POST",
          path: "/accommodations/31/images",
          body: createMultipartBody(),
          bodyEncoding: "multipart",
          onUploadProgress: vi.fn(),
        }),
      ).rejects.toMatchObject({
        name: "HttpTransportFailure",
        kind: expectedKind,
      });
    },
  );

  it("retains safe HTTP classification data from a failed progress upload", async () => {
    const fakeRequest = createFakeRequest();
    fakeRequest.status = 403;
    fakeRequest.responseText = JSON.stringify({
      success: false,
      error: { code: "M004", token: "private-response-token" },
    });
    fakeRequest.send.mockImplementation(() => fakeRequest.onload?.());
    const client = createProgressClient(fakeRequest);

    let failure: unknown;
    try {
      await client.request({
        method: "POST",
        path: "/accommodations/31/images",
        body: createMultipartBody(),
        bodyEncoding: "multipart",
        onUploadProgress: vi.fn(),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: "HttpTransportFailure",
      kind: "http",
      status: 403,
    });
    expect(JSON.stringify(failure)).not.toContain("private-response-token");
  });

  it("normalizes synchronous XMLHttpRequest setup failures", async () => {
    const fakeRequest = createFakeRequest();
    fakeRequest.open.mockImplementation(() => {
      throw new Error("private-browser-setup-detail");
    });
    const client = createProgressClient(fakeRequest);

    await expect(
      client.request({
        method: "POST",
        path: "/accommodations/31/images",
        body: createMultipartBody(),
        bodyEncoding: "multipart",
        onUploadProgress: vi.fn(),
      }),
    ).rejects.toMatchObject({
      name: "HttpTransportFailure",
      kind: "network",
    });
  });
});
