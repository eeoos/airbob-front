import { resolveImageUrl } from "./imageUrl";

const cloudFrontHost = "assets.example.cloudfront.net";

describe("resolveImageUrl", () => {
  it.each([null, undefined, "", "   "])(
    "returns an empty value for an absent image path",
    (value) => {
      expect(resolveImageUrl(value, cloudFrontHost)).toBe("");
    },
  );

  it("resolves relative image paths against the configured HTTPS host", () => {
    expect(resolveImageUrl("/accommodations/4/image.jpg", cloudFrontHost)).toBe(
      "https://assets.example.cloudfront.net/accommodations/4/image.jpg",
    );
    expect(resolveImageUrl("accommodations/4/image.jpg", cloudFrontHost)).toBe(
      "https://assets.example.cloudfront.net/accommodations/4/image.jpg",
    );
  });

  it("normalizes an explicit default HTTPS asset port", () => {
    expect(resolveImageUrl("image.jpg", `${cloudFrontHost}:443`)).toBe(
      "https://assets.example.cloudfront.net/image.jpg",
    );
  });

  it("recognizes only the exact configured hostname without substring matching", () => {
    expect(
      resolveImageUrl(
        "assets.example.cloudfront.net/accommodations/4/image.jpg",
        cloudFrontHost,
      ),
    ).toBe(
      "https://assets.example.cloudfront.net/accommodations/4/image.jpg",
    );
    expect(
      resolveImageUrl(
        "attacker.invalid/assets.example.cloudfront.net/image.jpg",
        cloudFrontHost,
      ),
    ).toBe(
      "https://assets.example.cloudfront.net/attacker.invalid/assets.example.cloudfront.net/image.jpg",
    );
  });

  it("preserves absolute HTTPS image URLs", () => {
    expect(
      resolveImageUrl("https://images.example.com/room.jpg?size=large", cloudFrontHost),
    ).toBe("https://images.example.com/room.jpg?size=large");
  });

  it("upgrades legacy absolute HTTP images instead of allowing mixed content", () => {
    expect(
      resolveImageUrl("http://images.example.com/room.jpg", cloudFrontHost),
    ).toBe("https://images.example.com/room.jpg");
  });

  it("rejects credential-bearing absolute image URLs", () => {
    expect(
      resolveImageUrl("https://user:password@images.example.com/room.jpg", cloudFrontHost),
    ).toBe("");
  });

  it("fails with a secret-safe message for an invalid asset host", () => {
    expect(() => resolveImageUrl("image.jpg", "bad.example/path")).toThrow(
      "Public image host configuration is invalid.",
    );
    expect(() => resolveImageUrl("image.jpg", `${cloudFrontHost}:8443`)).toThrow(
      "Public image host configuration is invalid.",
    );
  });
});
