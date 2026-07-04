import React from "react";
import { useSearchParams } from "react-router-dom";
import { SearchRoute } from "../../features/search";

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <SearchRoute
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
};

export default Search;
