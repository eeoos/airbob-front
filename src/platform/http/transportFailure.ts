type HttpTransportFailureKind =
  "cancelled" | "configuration" | "http" | "network" | "timeout";

interface HttpTransportFailureOptions {
  readonly cause?: unknown;
  readonly responseData?: unknown;
  readonly status?: number;
}

const transportFailureMessages: Readonly<
  Record<HttpTransportFailureKind, string>
> = Object.freeze({
  cancelled: "The request was cancelled.",
  configuration: "The request configuration is invalid.",
  http: "The HTTP request failed.",
  network: "The network request failed.",
  timeout: "The request timed out.",
});

export class HttpTransportFailure extends Error {
  readonly kind: HttpTransportFailureKind;
  readonly responseData: unknown;
  readonly status: number | undefined;
  override readonly cause?: unknown;

  constructor(
    kind: HttpTransportFailureKind,
    { cause, responseData, status }: HttpTransportFailureOptions = {},
  ) {
    super(transportFailureMessages[kind]);

    this.name = "HttpTransportFailure";
    this.kind = kind;
    this.responseData = responseData;
    this.status = status;

    Object.defineProperty(this, "responseData", {
      configurable: false,
      enumerable: false,
      value: responseData,
      writable: false,
    });
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: false,
        enumerable: false,
        value: cause,
        writable: false,
      });
    }

    Object.setPrototypeOf(this, HttpTransportFailure.prototype);
  }
}
