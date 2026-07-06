import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./AppHeader";
import styles from "./MainLayout.module.css";
import { getRouteShellForPathname } from "../routes/routeMatching";

interface MainLayoutProps {
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const routeShell = getRouteShellForPathname(location.pathname);

  return (
    <div className={styles.container}>
      <Header headerMode={routeShell.headerMode} />
      <main className={styles.main}>{children ?? <Outlet />}</main>
    </div>
  );
};
