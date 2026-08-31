import { AppError } from "./errors";
import { parseApiEnvelope } from "./envelope";

type Listing = { id: number; name: string };

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

  it.each([undefined, null, "<html>login</html>", {}, { success: "true" }])(
    "rejects malformed response %p",
    (response) => {
      expect(() => parseApiEnvelope(response)).toThrow(
        expect.objectContaining({
          kind: "invalid-response",
          code: "INVALID_API_RESPONSE",
        }),
      );
    },
  );

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
  ])(
    "maps an envelope failure to a secret-safe AppError",
    (response, kind, code) => {
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
    },
  );
});
