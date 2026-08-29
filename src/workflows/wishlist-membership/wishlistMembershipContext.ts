import { createContext } from "react";
import type { WishlistMembershipCommands } from "./wishlistMembership";

export const WishlistMembershipContext =
  createContext<WishlistMembershipCommands | null>(null);
