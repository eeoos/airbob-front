import styles from "./HomeScreen.module.css";

export interface HomeScreenProps {
  readonly subtitle: string;
  readonly title: string;
}

export function HomeScreen({ subtitle, title }: HomeScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroOverlay}>
          <div className={styles.heroContent}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
