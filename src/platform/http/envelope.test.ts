import { AppError } from "./errors";
import { inspectApiEnvelope, parseApiEnvelope } from "./envelope";

type Listing = { id: number; name: string };

describe("inspectApiEnvelope", () => {
  it("returns successful data by identity", () => {
    const listing: Listing = { id: 1, name: "Seoul stay" };

    expect(
      inspectApiEnvelope<Listing>({ success: true, data: listing, error: null }),
    ).toEqual({ kind: "data", data: listing });
  });

  it("keeps the backend error available for the legacy mapping boundary", () => {
    const backendError = {
      message: "예약을 찾을 수 없습니다.",
      status: 404,
      code: "RESERVATION_NOT_FOUND",
      errors: [{ field: "reservationUid", reason: "missing" }],
    };
    const inspection = inspectApiEnvelope({
      success: false,
      data: null,
      error: backendError,
    });

    expect(inspection).toEqual({ kind: "backend-error", error: backendError });
    expect(
      (inspection as { readonly kind: "backend-error"; readonly error: unknown })
        .error,
    ).toBe(backendError);
  });

  it.each([undefined, null, "<html>login</html>", {}, { success: "true" }])(
    "classifies malformed response %p as invalid",
    (response) => {
      expect(inspectApiEnvelope(response)).toEqual({ kind: "invalid-response" });
    },
  );

  it("distinguishes missing data from explicit empty data", () => {
    expect(inspectApiEnvelope({ success: true })).toEqual({
      kind: "invalid-response",
    });
    expect(inspectApiEnvelope({ success: true, data: null })).toEqual({
      kind: "empty-data",
    });
  });

  it("maps both missing and explicit empty data to null only when allowed", () => {
    expect(inspectApiEnvelope({ success: true }, { allowNull: true })).toEqual({
      kind: "data",
      data: null,
    });
    expect(
      inspectApiEnvelope({ success: true, data: null }, { allowNull: true }),
    ).toEqual({ kind: "data", data: null });
  });
});

describe("parseApiEnvelope", () => {
  it("returns a migrated boundary payload", () => {
    const response = {
      success: true,
      data: { id: 1, name: "Seoul stay" },
      error: null,
    };

    expect(parseApiEnvelope<Listing>(response)).toEqual(response.data);
  });

  it("returns null for nullable command responses", () => {
    expect(
      parseApiEnvelope<null>({ success: true }, { allowNull: true }),
    ).toBeNull();
  });

  it.each([
    [{ success: true }, "invalid-response", "INVALID_API_RESPONSE"],
    [{ success: true, data: null }, "empty-data", "EMPTY_API_DATA"],
    [
      {
        success: false,
        error: {
          status: 409,
          code: "RESERVATION_CONFLICT",
          message: "backend-secret-message-canary",
        },
      },
      "conflict",
      "RESERVATION_CONFLICT",
    ],
  ])("maps an envelope failure to a secret-safe AppError", (response, kind, code) => {
    let thrownError: unknown;

    try {
      parseApiEnvelope(response);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(AppError);
    expect(thrownError).toMatchObject({ kind, code });
    expect((thrownError as Error).message).not.toContain(
      "backend-secret-message-canary",
    );
    expect(JSON.stringify(thrownError)).not.toContain(
      "backend-secret-message-canary",
    );
  });
});
