import { useSearchParams } from "react-router-dom";
import { WishlistRoute as LegacyWishlistRoute } from "../../../features/wishlist/WishlistRoute";

export function WishlistRoute() {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <LegacyWishlistRoute
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
}

export default WishlistRoute;
