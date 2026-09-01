import { createSessionRuntimeLeaseId } from "./runtimeLeaseId";

describe("session runtime lease id", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers the platform UUID generator", () => {
    const randomUUID = vi.fn(() => "10000000-0000-4000-8000-000000000001");
    const getRandomValues = vi.fn();
    vi.stubGlobal("crypto", { randomUUID, getRandomValues });

    expect(createSessionRuntimeLeaseId()).toBe(
      "10000000-0000-4000-8000-000000000001",
    );
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it("formats a secure random fallback as an RFC 4122 version 4 UUID", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(createSessionRuntimeLeaseId()).toBe(
      "00010203-0405-4607-8809-0a0b0c0d0e0f",
    );
  });

  it("fails closed when no cryptographic source is available", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() => createSessionRuntimeLeaseId()).toThrow(
      "Secure session runtime lease generation is unavailable.",
    );
  });
});
