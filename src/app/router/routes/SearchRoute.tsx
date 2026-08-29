import { useSearchParams } from "react-router-dom";
import { SearchRoute as LegacySearchRoute } from "../../../features/search/SearchRoute";

export function SearchRoute() {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <LegacySearchRoute
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
}

export default SearchRoute;
