import type { HTMLAttributes, ReactNode } from "react";
import styles from "./ListContainer.module.css";

export interface ListContainerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  readonly children: ReactNode;
  readonly columns?: 1 | 2 | 3 | 4;
  readonly gap?: 10 | 24 | 40;
}

export function ListContainer({
  children,
  className,
  columns = 4,
  gap = 24,
  ...containerProps
}: ListContainerProps) {
  return (
    <div
      {...containerProps}
      className={[styles.container, className].filter(Boolean).join(" ")}
      data-columns={columns}
      data-gap={gap}
    >
      {children}
    </div>
  );
}
