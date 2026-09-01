import { onAuthError } from "../session/authEvents";
import { sessionOwnedAuthEventPolicy } from "./authEventPolicy";
import { httpClient, type HttpClientResponse } from "./client";
import { requestApiData, requestApiDataNullable } from "./request";
import { HttpTransportFailure } from "./transportFailure";

interface ListingWire {
  readonly id: number;
  readonly name: string;
}

const response = (
  data: unknown,
  contentType = "application/json;charset=utf-8",
): HttpClientResponse => ({
  contentType,
  data,
  status: 200,
});

const successfulListingResponse = () =>
  response({
    success: true,
    data: { id: 1, name: "Seoul stay" },
    error: null,
  });

const browserResponse = (status: number, data: unknown): Response =>
  ({
    headers: { get: () => "application/json;charset=utf-8" },
    status,
    text: async () => JSON.stringify(data),
  }) as unknown as Response;

describe("platform API request", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends the native transport contract and unwraps a successful envelope", async () => {
    const controller = new AbortController();
    const requestSpy = vi
      .spyOn(httpClient, "request")
      .mockResolvedValue(successfulListingResponse());

    await expect(
      requestApiData<ListingWire>({
        method: "GET",
        path: "/listings",
        params: { cursor: "next" },
        signal: controller.signal,
      }),
    ).resolves.toEqual({ id: 1, name: "Seoul stay" });
    expect(requestSpy).toHaveBeenCalledWith({
      method: "GET",
      path: "/listings",
      params: { cursor: "next" },
      signal: controller.signal,
    });
  });

  it("passes only the narrow idempotency capability to the native transport", async () => {
    const requestSpy = vi
      .spyOn(httpClient, "request")
      .mockResolvedValue(successfulListingResponse());

    await requestApiData<ListingWire>({
      method: "POST",
      path: "/reservations",
      body: { quote_uid: "5f54b9c2-5b9e-45a3-a4f4-7a119227c01a" },
      idempotencyKey: "checkout:flow_01",
    });

    expect(requestSpy).toHaveBeenCalledWith({
      method: "POST",
      path: "/reservations",
      body: { quote_uid: "5f54b9c2-5b9e-45a3-a4f4-7a119227c01a" },
      idempotencyKey: "checkout:flow_01",
    });
    expect(requestSpy.mock.calls[0]?.[0]).not.toHaveProperty("headers");
  });

  it("omits undefined fields and auth ownership metadata from the wire contract", async () => {
    const requestSpy = vi
      .spyOn(httpClient, "request")
      .mockResolvedValue(successfulListingResponse());

    await requestApiData<ListingWire>({
      method: "GET",
      path: "/listings",
      signal: undefined,
      authEventPolicy: sessionOwnedAuthEventPolicy,
    });

    expect(requestSpy).toHaveBeenCalledOnce();
    expect(requestSpy.mock.calls[0]?.[0]).not.toHaveProperty("signal");
    expect(requestSpy.mock.calls[0]?.[0]).not.toHaveProperty("authEventPolicy");
    expect(requestSpy.mock.calls[0]?.[0]).not.toHaveProperty("idempotencyKey");
  });

  it("validates an exact command success status without forwarding policy to the transport", async () => {
    const requestSpy = vi.spyOn(httpClient, "request").mockResolvedValue({
      ...successfulListingResponse(),
      status: 202,
    });

    await expect(
      requestApiData<ListingWire>({
        method: "POST",
        path: "/commands",
        expectedSuccessStatus: 202,
      }),
    ).resolves.toEqual({ id: 1, name: "Seoul stay" });
    expect(requestSpy).toHaveBeenCalledWith({
      method: "POST",
      path: "/commands",
    });
  });

  it.each([200, 201])(
    "rejects HTTP %s when a command contract requires 202 Accepted",
    async (status) => {
      vi.spyOn(httpClient, "request").mockResolvedValue({
        ...successfulListingResponse(),
        status,
      });

      await expect(
        requestApiData<ListingWire>({
          method: "POST",
          path: "/commands",
          expectedSuccessStatus: 202,
        }),
      ).rejects.toMatchObject({
        name: "AppError",
        code: "UNEXPECTED_HTTP_STATUS",
        kind: "invalid-response",
        status,
      });
    },
  );

  it("preserves multipart bodies and progress callbacks by identity", async () => {
    const body = new FormData();
    body.append("images", new File(["image"], "stay.png"));
    const onUploadProgress = vi.fn();
    const requestSpy = vi.spyOn(httpClient, "request").mockResolvedValue(
      response({
        success: true,
        data: { uploaded_images: [] },
        error: null,
      }),
    );

    await expect(
      requestApiData({
        method: "POST",
        path: "/reviews/901/images",
        body,
        bodyEncoding: "multipart",
        onUploadProgress,
      }),
    ).resolves.toEqual({ uploaded_images: [] });
    expect(requestSpy).toHaveBeenCalledWith({
      method: "POST",
      path: "/reviews/901/images",
      body,
      bodyEncoding: "multipart",
      onUploadProgress,
    });
  });

  it("allows an empty successful command only through the nullable helper", async () => {
    vi.spyOn(httpClient, "request").mockResolvedValue(
      response({ success: true, data: null, error: null }),
    );

    await expect(
      requestApiData({ method: "DELETE", path: "/resource/1" }),
    ).rejects.toMatchObject({
      name: "AppError",
      code: "EMPTY_API_DATA",
      kind: "empty-data",
    });
    await expect(
      requestApiDataNullable({ method: "DELETE", path: "/resource/1" }),
    ).resolves.toBeNull();
  });

  it("normalizes a native transport timeout", async () => {
    const rawFailure = new HttpTransportFailure("timeout", {
      cause: new Error("private-timeout-detail"),
    });
    vi.spyOn(httpClient, "request").mockRejectedValue(rawFailure);

    await expect(
      requestApiData({ method: "GET", path: "/slow" }),
    ).rejects.toMatchObject({
      name: "AppError",
      code: "REQUEST_TIMEOUT",
      kind: "timeout",
      retryable: true,
      cause: rawFailure,
    });
  });

  it("rejects an HTML response before parsing its body as an API envelope", async () => {
    vi.spyOn(httpClient, "request").mockResolvedValue(
      response(
        "<!doctype html><html><body>Login</body></html>",
        "text/html; charset=utf-8",
      ),
    );

    await expect(
      requestApiData({ method: "GET", path: "/auth/me" }),
    ).rejects.toMatchObject({
      name: "AppError",
      code: "INVALID_API_RESPONSE",
      kind: "invalid-response",
    });
  });

  it("publishes an authentication envelope once for a global request", async () => {
    const listener = vi.fn();
    const unsubscribe = onAuthError(listener);
    vi.spyOn(httpClient, "request").mockResolvedValue(
      response({
        success: false,
        data: null,
        error: { code: "M004", message: "expired", status: 403 },
      }),
    );

    try {
      await expect(
        requestApiData({ method: "GET", path: "/protected" }),
      ).rejects.toMatchObject({
        code: "M004",
        kind: "authentication",
      });
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      unsubscribe();
    }
  });

  it("suppresses session-owned envelope auth signaling", async () => {
    const listener = vi.fn();
    const unsubscribe = onAuthError(listener);
    vi.spyOn(httpClient, "request").mockResolvedValue(
      response({
        success: false,
        data: null,
        error: { code: "M004", message: "expired", status: 403 },
      }),
    );

    try {
      await expect(
        requestApiDataNullable({
          method: "POST",
          path: "/auth/login",
          body: { email: "guest@example.com", password: "password" },
          authEventPolicy: sessionOwnedAuthEventPolicy,
        }),
      ).rejects.toMatchObject({ code: "M004" });
      expect(listener).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it.each([
    ["global", undefined, 1],
    ["session-owned", sessionOwnedAuthEventPolicy, 0],
  ] as const)(
    "applies %s auth ownership to transport failures",
    async (_name, authEventPolicy, expectedSignals) => {
      const listener = vi.fn();
      const unsubscribe = onAuthError(listener);
      vi.spyOn(httpClient, "request").mockRejectedValue(
        new HttpTransportFailure("http", {
          status: 403,
          responseData: {
            success: false,
            error: { code: "M004", message: "expired" },
          },
        }),
      );

      try {
        await expect(
          requestApiData({
            method: "GET",
            path: "/auth/me",
            ...(authEventPolicy === undefined ? {} : { authEventPolicy }),
          }),
        ).rejects.toMatchObject({ kind: "authentication" });
        expect(listener).toHaveBeenCalledTimes(expectedSignals);
      } finally {
        unsubscribe();
      }
    },
  );

  it.each([
    [401, null, "AUTHENTICATION_REQUIRED"],
    [
      403,
      {
        success: false,
        data: null,
        error: { code: "M004", message: "expired" },
      },
      "M004",
    ],
  ] as const)(
    "publishes one auth event for a real native HTTP %s failure",
    async (status, data, expectedCode) => {
      const listener = vi.fn();
      const unsubscribe = onAuthError(listener);
      const fetchRequest = vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          browserResponse(status, data),
      );
      vi.stubGlobal("fetch", fetchRequest);

      try {
        await expect(
          requestApiData({ method: "GET", path: "/protected" }),
        ).rejects.toMatchObject({
          code: expectedCode,
          kind: "authentication",
        });
        expect(listener).toHaveBeenCalledOnce();
        expect(fetchRequest).toHaveBeenCalledOnce();
        expect(fetchRequest.mock.calls[0]?.[1]).toMatchObject({
          credentials: "include",
          method: "GET",
        });
      } finally {
        unsubscribe();
      }
    },
  );
});
