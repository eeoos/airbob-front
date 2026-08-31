import {
  isSessionOwnedAuthEventRequest,
  sessionOwnedAuthEventPolicy,
} from "./authEventPolicy";

describe("platform auth event policy", () => {
  it("uses frozen request metadata instead of a transport field", () => {
    expect(sessionOwnedAuthEventPolicy).toEqual({
      authEventPolicy: "session-owned",
    });
    expect(Object.isFrozen(sessionOwnedAuthEventPolicy)).toBe(true);
    expect(sessionOwnedAuthEventPolicy).not.toHaveProperty("headers");
    expect(sessionOwnedAuthEventPolicy).not.toHaveProperty("params");
    expect(sessionOwnedAuthEventPolicy).not.toHaveProperty("data");
  });

  it("recognizes only the exact session-owned metadata marker", () => {
    expect(isSessionOwnedAuthEventRequest(sessionOwnedAuthEventPolicy)).toBe(
      true,
    );
    expect(isSessionOwnedAuthEventRequest({ authEventPolicy: "global" })).toBe(
      false,
    );
    expect(isSessionOwnedAuthEventRequest(null)).toBe(false);
  });
});
