import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import type { WishlistProjectionPort } from "./wishlistProjectionPort";

describe("wishlist projection port", () => {
  it("requires an explicit authenticated scope for every cache-only operation", () => {
    type OperationInput = Parameters<WishlistProjectionPort["memoSaved"]>[0];
    type HasRequiredScope = OperationInput extends {
      readonly scope: AuthenticatedSessionScope;
    }
      ? true
      : false;

    const hasRequiredScope: HasRequiredScope = true;
    expect(hasRequiredScope).toBe(true);
  });
});
