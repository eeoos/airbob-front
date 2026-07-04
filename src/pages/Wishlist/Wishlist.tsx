import React from "react";
import { WishlistRoute } from "../../features/wishlist";
import styles from "./Wishlist.module.css";

const Wishlist: React.FC = () => (
  <WishlistRoute
    className={styles.container}
    toastClassName={styles.toastContainer}
  />
);

export default Wishlist;
