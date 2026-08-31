import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { onAuthError } from "../session/authEvents";
import {
  isSessionOwnedAuthEventRequest,
  sessionOwnedAuthEventPolicy,
} from "./authEventPolicy";
import {
  httpClient,
  MULTIPART_API_REQUEST_TIMEOUT_MS,
} from "./client";
import { requestApiData, requestApiDataNullable } from "./request";

interface ListingWire {
  readonly id: number;
  readonly name: string;
}

const jsonHeaders = { "content-type": "application/json;charset=utf-8" };

const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  headers: Record<string, string> = jsonHeaders,
) => ({
  config,
  data,
  headers,
  status: 200,
  statusText: "OK",
});

describe("platform API request", () => {
  const originalAdapter = httpClient.defaults.adapter;

  afterEach(() => {
    httpClient.defaults.adapter = originalAdapter;
    jest.restoreAllMocks();
  });

  it("sends a plain request contract and unwraps a successful envelope", async () => {
    const controller = new AbortController();
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/listings");
      expect(config.params).toEqual({ cursor: "next" });
      expect(config.signal).toBe(controller.signal);

      return response(config, {
        success: true,
        data: { id: 1, name: "Seoul stay" },
        error: null,
      });
    };
    httpClient.defaults.adapter = adapter;

    await expect(
      requestApiData<ListingWire>({
        method: "GET",
        path: "/listings",
        params: { cursor: "next" },
        signal: controller.signal,
      }),
    ).resolves.toEqual({ id: 1, name: "Seoul stay" });
  });

  it("preserves multipart bodies through the real Axios transform pipeline", async () => {
    const image = new File(["image"], "stay.png", { type: "image/png" });
    const body = new FormData();
    body.append("images", image);
    const adapter: AxiosAdapter = async (config) => {
      expect(config.data).toBe(body);
      expect(config.data).toBeInstanceOf(FormData);
      expect(config.headers.getContentType()).toBe("multipart/form-data");
      expect(config.timeout).toBe(MULTIPART_API_REQUEST_TIMEOUT_MS);

      return response(config, {
        success: true,
        data: { uploaded_images: [] },
        error: null,
      });
    };
    httpClient.defaults.adapter = adapter;

    await expect(
      requestApiData({
        method: "POST",
        path: "/reviews/901/images",
        body,
        bodyEncoding: "multipart",
      }),
    ).resolves.toEqual({ uploaded_images: [] });
  });

  it("maps Axios upload bytes to the public integer progress contract", async () => {
    const onUploadProgress = jest.fn();
    const adapter: AxiosAdapter = async (config) => {
      config.onUploadProgress?.({ loaded: 1, total: 3 } as never);
      config.onUploadProgress?.({ loaded: 2 } as never);

      return response(config, {
        success: true,
        data: { uploaded_images: [] },
        error: null,
      });
    };
    httpClient.defaults.adapter = adapter;

    await requestApiData({
      method: "POST",
      path: "/accommodations/31/images",
      body: new FormData(),
      bodyEncoding: "multipart",
      onUploadProgress,
    });

    expect(onUploadProgress).toHaveBeenCalledTimes(1);
    expect(onUploadProgress).toHaveBeenCalledWith(33);
  });

  it("allows an empty successful command only through the nullable helper", async () => {
    const adapter: AxiosAdapter = async (config) =>
      response(config, { success: true, data: null, error: null });
    httpClient.defaults.adapter = adapter;

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

  it("normalizes raw transport failures for migrated adapters", async () => {
    const rawFailure = {
      isAxiosError: true,
      code: "ETIMEDOUT",
      config: {},
    };
    const adapter: AxiosAdapter = async () => {
      throw rawFailure;
    };
    httpClient.defaults.adapter = adapter;

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
    const adapter: AxiosAdapter = async (config) =>
      response(
        config,
        "<!doctype html><html><body>Login</body></html>",
        { "content-type": "text/html; charset=utf-8" },
      );
    httpClient.defaults.adapter = adapter;

    await expect(
      requestApiData({ method: "GET", path: "/auth/me" }),
    ).rejects.toMatchObject({
      name: "AppError",
      code: "INVALID_API_RESPONSE",
      kind: "invalid-response",
    });
  });

  it("publishes an authentication envelope once for a global request", async () => {
    const listener = jest.fn();
    const unsubscribe = onAuthError(listener);
    const adapter: AxiosAdapter = async (config) =>
      response(config, {
        success: false,
        data: null,
        error: { code: "M004", message: "expired", status: 403 },
      });
    httpClient.defaults.adapter = adapter;

    try {
      await expect(
        requestApiData({ method: "GET", path: "/protected" }),
      ).rejects.toMatchObject({
        code: "M004",
        kind: "authentication",
      });
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it("suppresses session-owned auth signaling without leaking policy onto the wire", async () => {
    const listener = jest.fn();
    const unsubscribe = onAuthError(listener);
    const body = { email: "guest@example.com", password: "password" };
    const adapter: AxiosAdapter = async (config) => {
      expect(isSessionOwnedAuthEventRequest(config)).toBe(true);
      expect(config.headers).not.toHaveProperty("authEventPolicy");
      expect(config.params).toBeUndefined();
      expect(JSON.parse(config.data as string)).toEqual(body);
      expect(config.data).not.toContain("authEventPolicy");

      return response(config, {
        success: false,
        data: null,
        error: { code: "M004", message: "expired", status: 403 },
      });
    };
    httpClient.defaults.adapter = adapter;

    try {
      await expect(
        requestApiDataNullable({
          method: "POST",
          path: "/auth/login",
          body,
          authEventPolicy: sessionOwnedAuthEventPolicy,
        }),
      ).rejects.toMatchObject({ code: "M004" });
      expect(listener).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it.each([
    ["raw 401", 401, null],
    [
      "raw M004",
      403,
      {
        success: false,
        data: null,
        error: { code: "M004", message: "expired", status: 403 },
      },
    ],
  ])(
    "suppresses the global auth signal for a session-owned %s transport rejection",
    async (_case, status, data) => {
      const listener = jest.fn();
      const unsubscribe = onAuthError(listener);
      const adapter: AxiosAdapter = async (config) => {
        throw new AxiosError(
          "authentication failed",
          undefined,
          config,
          undefined,
          {
            ...response(config, data),
            status,
          },
        );
      };
      httpClient.defaults.adapter = adapter;

      try {
        await expect(
          requestApiData({
            method: "GET",
            path: "/auth/me",
            authEventPolicy: sessionOwnedAuthEventPolicy,
          }),
        ).rejects.toMatchObject({ kind: "authentication" });
        expect(listener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    },
  );
});
