import React from "react";
import styles from "./ListingCard.module.css";

interface ListingCardBaseProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  selected?: boolean;
  subtitle?: React.ReactNode;
}

type ListingCardImageProps =
  | {
      imageAlt: string;
      imageUrl: string;
    }
  | {
      imageAlt?: string;
      imageUrl?: undefined;
    };

export type ListingCardProps = ListingCardBaseProps & ListingCardImageProps;

const cx = (...classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(" ");

export function ListingCard({
  actions,
  children,
  className,
  imageAlt,
  imageUrl,
  selected,
  subtitle,
  title,
  ...cardProps
}: ListingCardProps) {
  return (
    <article
      {...cardProps}
      aria-selected={selected}
      className={cx(styles.card, selected && styles.selected, className)}
    >
      {imageUrl && (
        <img className={styles.image} src={imageUrl} alt={imageAlt ?? title} />
      )}
      <div className={styles.body}>
        <div className={styles.content}>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {children && <div className={styles.children}>{children}</div>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </article>
  );
}
