import type { AccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import { ImageWithFallback } from "../../../../shared/ui";
import AmenityIcon from "./AmenityIcon";
import styles from "./AccommodationOverview.module.css";

interface AccommodationOverviewProps {
  detailView: AccommodationDetailViewModel;
  maxDescriptionLength?: number;
  onOpenDescription: () => void;
}

const DEFAULT_MAX_DESCRIPTION_LENGTH = 200;

export function AccommodationOverview({
  detailView,
  maxDescriptionLength = DEFAULT_MAX_DESCRIPTION_LENGTH,
  onOpenDescription,
}: AccommodationOverviewProps) {
  const isDescriptionLong =
    detailView.description.length > maxDescriptionLength;
  const visibleDescription = isDescriptionLong
    ? `${detailView.description.substring(0, maxDescriptionLength)}...`
    : detailView.description;

  return (
    <>
      <section
        className={styles.locationSection}
        aria-labelledby="accommodation-overview-title"
      >
        <div className={styles.locationInfo}>
          <h2 id="accommodation-overview-title" className={styles.address}>
            {detailView.overviewTitleLabel}
          </h2>
          <span className={styles.maxOccupancy}>
            {detailView.counts.guestLabel}
          </span>
        </div>
      </section>

      {detailView.amenities.length > 0 && (
        <section className={styles.amenitiesSection} aria-label="주요 편의시설">
          <ul className={styles.amenitiesGrid}>
            {detailView.amenities.map((amenity) => (
              <li
                key={amenity.key}
                className={styles.amenityItem}
                data-amenity-code={amenity.type}
                data-amenity-known={amenity.isKnown}
              >
                <AmenityIcon type={amenity.type} decorative />
                <span>{amenity.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.mainContent}>
        <section className={styles.section}>
          <div className={styles.hostInfo}>
            <div className={styles.hostAvatar}>
              <ImageWithFallback
                src={detailView.hostSummary.avatarUrl}
                alt={detailView.hostSummary.name}
                fallback={
                  <div
                    className={styles.avatarPlaceholder}
                    role="img"
                    aria-label={`${detailView.hostSummary.name} 프로필 이미지 없음`}
                  >
                    {detailView.hostSummary.avatarInitial}
                  </div>
                }
              />
            </div>
            <div className={styles.hostDetails}>
              <span className={styles.hostLabel}>호스트:</span>
              <span className={styles.hostName}>
                {detailView.hostSummary.displayName}
              </span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          {detailView.description && (
            <>
              <p className={styles.description}>{visibleDescription}</p>
              {isDescriptionLong && (
                <button
                  type="button"
                  className={styles.showMoreButton}
                  onClick={onOpenDescription}
                >
                  더 보기
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
