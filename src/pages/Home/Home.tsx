import React from "react";
import { MainLayout } from "../../layouts";
import styles from "./Home.module.css";

const Home: React.FC = () => {
  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.hero}>
          <div className={styles.heroOverlay}>
            <div className={styles.heroContent}>
              <h1 className={styles.title}>Airbob에서 특별한 숙소를 찾아보세요</h1>
              <p className={styles.subtitle}>
                전 세계 수백만 개의 숙소 중에서 선택하세요
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Home;
