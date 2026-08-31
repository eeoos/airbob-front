import { useContext } from "react";
import { WishlistMembershipContext } from "./wishlistMembershipContext";

export const useWishlistMembership = () => {
  const commands = useContext(WishlistMembershipContext);

  if (commands === null) {
    throw new Error(
      "useWishlistMembership must be used within WishlistMembershipProvider",
    );
  }

  return commands;
};
