import React from "react";
import styles from "./ListContainer.module.css";

interface ListContainerProps {
  children: React.ReactNode;
  columns?: number;
  gap?: number;
}

export const ListContainer: React.FC<ListContainerProps> = ({
  children,
  columns = 4,
  gap = 24,
}) => {
  return (
    <div
      className={styles.container}
      style={
        {
          "--columns": columns,
          "--gap": `${gap}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
};





