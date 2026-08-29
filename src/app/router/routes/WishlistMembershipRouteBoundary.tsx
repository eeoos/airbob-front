import type { ReactNode } from "react";
import { WishlistMembershipProvider } from "../../../workflows/wishlist-membership";
import { useSession } from "../../session/useSession";

export function WishlistMembershipRouteBoundary({
  children,
}: {
  readonly children: ReactNode;
}) {
  const session = useSession();

  return (
    <WishlistMembershipProvider session={session}>
      {children}
    </WishlistMembershipProvider>
  );
}
