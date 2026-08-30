import { useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  createWishlistQueryCacheProjection,
  type WishlistProjectionPort,
} from "../../features/wishlist/public";
import {
  createWishlistMembership,
  type WishlistMembershipSession,
  type WishlistMembershipTransport,
} from "./wishlistMembership";
import { WishlistMembershipContext } from "./wishlistMembershipContext";
import { wishlistMembershipTransport } from "./wishlistMembershipTransport";

type ProjectionFactory = (
  queryClient: ReturnType<typeof useQueryClient>,
) => WishlistProjectionPort;

export interface WishlistMembershipProviderProps {
  readonly children: ReactNode;
  readonly session: WishlistMembershipSession;
  readonly transport?: WishlistMembershipTransport;
  readonly projectionFactory?: ProjectionFactory;
}

export function WishlistMembershipProvider({
  children,
  session,
  transport = wishlistMembershipTransport,
  projectionFactory = createWishlistQueryCacheProjection,
}: WishlistMembershipProviderProps) {
  const queryClient = useQueryClient();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const sessionPort = useMemo<WishlistMembershipSession>(
    () => ({
      captureAuthenticatedSession: () =>
        sessionRef.current.captureAuthenticatedSession(),
      isCurrentSession: (scope) =>
        sessionRef.current.isCurrentSession(scope),
    }),
    [],
  );

  const commands = useMemo(
    () =>
      createWishlistMembership({
        projection: projectionFactory(queryClient),
        session: sessionPort,
        transport,
      }),
    [projectionFactory, queryClient, sessionPort, transport],
  );

  useEffect(() => () => commands.dispose(), [commands]);

  return (
    <WishlistMembershipContext.Provider value={commands}>
      {children}
    </WishlistMembershipContext.Provider>
  );
}
