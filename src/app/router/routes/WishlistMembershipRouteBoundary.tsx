import type { ReactNode } from "react";
import { WishlistMembershipProvider } from "../../../workflows/wishlist-membership";
import { createAppWishlistProjection } from "../wishlistProjection";
import { useSession } from "../../session/useSession";

export function WishlistMembershipRouteBoundary({
  children,
}: {
  readonly children: ReactNode;
}) {
  const session = useSession();

  return (
    <WishlistMembershipProvider
      projectionFactory={createAppWishlistProjection}
      session={session}
    >
      {children}
    </WishlistMembershipProvider>
  );
}
