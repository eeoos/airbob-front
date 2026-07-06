import React from "react";
import { useSearchParams } from "react-router-dom";
import { WishlistRoute } from "../../features/wishlist";
import styles from "./Wishlist.module.css";

const Wishlist: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <WishlistRoute
      className={styles.container}
      searchParams={searchParams}
      setSearchParams={setSearchParams}
      toastClassName={styles.toastContainer}
    />
  );
};

export default Wishlist;
