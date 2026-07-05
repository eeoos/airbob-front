import React from "react";
import { getHomeHeroViewModel } from "./lib/homeHeroViewModel";
import styles from "./HomeRoute.module.css";

export const HomeRoute: React.FC = () => {
  const hero = getHomeHeroViewModel();

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroOverlay}>
          <div className={styles.heroContent}>
            <h1 className={styles.title}>{hero.title}</h1>
            <p className={styles.subtitle}>{hero.subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
