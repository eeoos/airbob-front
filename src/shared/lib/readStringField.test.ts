import { readBooleanField, readStringField } from "./readStringField";

describe("safe structural field readers", () => {
  it("reads only fields whose runtime type matches", () => {
    const value = { code: "SERVER_ERROR", retryable: true };

    expect(readStringField(value, "code")).toBe("SERVER_ERROR");
    expect(readBooleanField(value, "retryable")).toBe(true);
    expect(readStringField(value, "retryable")).toBeNull();
    expect(readBooleanField(value, "code")).toBeNull();
  });

  it("returns null for absent fields and non-object values", () => {
    expect(readStringField(null, "code")).toBeNull();
    expect(readBooleanField("retryable", "retryable")).toBeNull();
    expect(readBooleanField({}, "retryable")).toBeNull();
  });
});
