import { createCryptographicUuid, sha256Base64Url } from "./secureIdentifiers";

describe("secure identifiers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses and validates a native cryptographic UUID", () => {
    const randomUUID = vi.fn(() => "10000000-0000-4000-8000-000000000001");
    vi.stubGlobal("crypto", { randomUUID });

    expect(createCryptographicUuid()).toBe(
      "10000000-0000-4000-8000-000000000001",
    );
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("rejects a malformed UUID from the random source", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "predictable" });

    expect(() => createCryptographicUuid()).toThrow("invalid");
  });

  it("creates the standard unpadded base64url SHA-256 digest", async () => {
    await expect(sha256Base64Url("hello")).resolves.toBe(
      "LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ",
    );
  });
});
