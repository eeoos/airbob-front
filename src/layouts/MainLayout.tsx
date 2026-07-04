import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./AppHeader";
import styles from "./MainLayout.module.css";

interface MainLayoutProps {
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>{children ?? <Outlet />}</main>
    </div>
  );
};





