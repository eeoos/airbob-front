import type { AccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
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
      <div className={styles.locationSection}>
        <div className={styles.locationInfo}>
          <span className={styles.address}>
            {detailView.overviewTitleLabel}
          </span>
          <span className={styles.maxOccupancy}>
            {detailView.counts.guestLabel}
          </span>
        </div>
      </div>

      {detailView.amenities.length > 0 && (
        <div className={styles.amenitiesSection}>
          <div className={styles.amenitiesGrid}>
            {detailView.amenities.map((amenity) => (
              <div key={amenity.key} className={styles.amenityItem}>
                <AmenityIcon type={amenity.type} decorative />
                <span>{amenity.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.mainContent}>
        <section className={styles.section}>
          <div className={styles.hostInfo}>
            <div className={styles.hostAvatar}>
              {detailView.hostSummary.avatarUrl ? (
                <img
                  src={detailView.hostSummary.avatarUrl}
                  alt={detailView.hostSummary.name}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {detailView.hostSummary.avatarInitial}
                </div>
              )}
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
