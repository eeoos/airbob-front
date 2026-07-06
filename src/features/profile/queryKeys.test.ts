import { profileQueryKeys } from "./queryKeys";

describe("profileQueryKeys", () => {
  it("builds stable host listing keys", () => {
    expect(profileQueryKeys.hostListingsRoot).toEqual([
      "profile",
      "hostListings",
    ]);
    expect(profileQueryKeys.hostListings("status=published&page=1")).toEqual([
      "profile",
      "hostListings",
      "status=published&page=1",
    ]);
  });
});
