import { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import {
  WishlistController,
  type WishlistNavigationCommands,
  type WishlistRouteView,
} from "../../../screens/wishlist/public";
import { useSession } from "../../session/useSession";
import { wishlistCodec } from "../codecs/wishlistCodec";
import { routeTo } from "../paths";
import { WishlistMembershipRouteBoundary } from "./WishlistMembershipRouteBoundary";

const toScreenView = (
  state: ReturnType<typeof wishlistCodec.parse>,
): WishlistRouteView => {
  switch (state.view) {
    case "wishlist-detail":
      return { kind: "wishlist-detail", wishlistId: state.wishlistId };
    case "recently-viewed":
      return { kind: "recently-viewed" };
    case "index":
      return { kind: "index" };
  }
};

function WishlistRouteContent() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const view = toScreenView(wishlistCodec.parse(searchParams));
  const scope = session.captureAuthenticatedSession();
  const navigation = useMemo<WishlistNavigationCommands>(() => {
    const withCurrentHash = (path: string) => `${path}${location.hash}`;

    return {
      openIndex: () => navigate(withCurrentHash(routeTo.wishlist())),
      replaceWithIndex: () =>
        navigate(withCurrentHash(routeTo.wishlist()), { replace: true }),
      openRecentlyViewed: () =>
        navigate(
          withCurrentHash(routeTo.wishlist({ view: "recently-viewed" })),
        ),
      openWishlistDetail: (wishlistId) =>
        navigate(withCurrentHash(routeTo.wishlist({ id: wishlistId }))),
      openAccommodation: (accommodationId) => {
        browserWindowNavigation.openInNewTab(
          routeTo.accommodationDetail(accommodationId),
        );
      },
    };
  }, [location.hash, navigate]);

  if (scope === null || !session.isCurrentSession(scope)) return null;

  return (
    <WishlistController navigation={navigation} scope={scope} view={view} />
  );
}

function WishlistRoute() {
  return (
    <WishlistMembershipRouteBoundary>
      <WishlistRouteContent />
    </WishlistMembershipRouteBoundary>
  );
}

export default WishlistRoute;
