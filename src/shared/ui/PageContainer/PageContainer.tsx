import type { HTMLAttributes, ReactNode } from "react";
import { requireCssModuleClass } from "../../styles/requireCssModuleClass";
import styles from "./PageContainer.module.css";

type PageContainerVariant = "edge" | "full" | "wide" | "content" | "narrow";

interface PageContainerProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children"
> {
  readonly as?: "div" | "section";
  readonly children: ReactNode;
  readonly variant: PageContainerVariant;
}

/** Owns page-level width and horizontal gutter recipes below the route shell. */
export function PageContainer({
  as = "div",
  children,
  className,
  variant,
  ...attributes
}: PageContainerProps) {
  const containerClassName = [
    requireCssModuleClass(styles.container),
    requireCssModuleClass(styles[variant]),
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const containerProps = {
    ...attributes,
    className: containerClassName,
    "data-page-container": variant,
  };

  return as === "section" ? (
    <section {...containerProps}>{children}</section>
  ) : (
    <div {...containerProps}>{children}</div>
  );
}
