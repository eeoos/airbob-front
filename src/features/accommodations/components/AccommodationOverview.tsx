import { AccommodationDetail } from "../../../types/accommodation";
import { getAccommodationTypeLabel, getAmenityLabel } from "../../../utils/codes";
import { getImageUrl } from "../../../utils/image";
import AmenityIcon from "./AmenityIcon";
import styles from "./AccommodationOverview.module.css";

interface AccommodationOverviewProps {
  accommodation: AccommodationDetail;
  maxDescriptionLength?: number;
  onOpenDescription: () => void;
}

const DEFAULT_MAX_DESCRIPTION_LENGTH = 200;

export function AccommodationOverview({
  accommodation,
  maxDescriptionLength = DEFAULT_MAX_DESCRIPTION_LENGTH,
  onOpenDescription,
}: AccommodationOverviewProps) {
  const locationName =
    accommodation.address_summary.city || accommodation.address_summary.country;
  const isDescriptionLong =
    accommodation.description.length > maxDescriptionLength;
  const visibleDescription = isDescriptionLong
    ? `${accommodation.description.substring(0, maxDescriptionLength)}...`
    : accommodation.description;

  return (
    <>
      <div className={styles.locationSection}>
        <div className={styles.locationInfo}>
          <span className={styles.address}>
            {locationName}의 {getAccommodationTypeLabel(accommodation.type)}
          </span>
          <span className={styles.maxOccupancy}>
            최대 인원 {accommodation.policy.max_occupancy}명
          </span>
        </div>
      </div>

      {accommodation.amenities.length > 0 && (
        <div className={styles.amenitiesSection}>
          <div className={styles.amenitiesGrid}>
            {accommodation.amenities.map((amenity, index) => (
              <div key={`${amenity.type}-${index}`} className={styles.amenityItem}>
                <AmenityIcon type={amenity.type} decorative />
                <span>{getAmenityLabel(amenity.type)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.mainContent}>
        <section className={styles.section}>
          <div className={styles.hostInfo}>
            <div className={styles.hostAvatar}>
              {accommodation.host.thumbnail_image_url ? (
                <img
                  src={getImageUrl(accommodation.host.thumbnail_image_url)}
                  alt={accommodation.host.nickname}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {accommodation.host.nickname.charAt(0)}
                </div>
              )}
            </div>
            <div className={styles.hostDetails}>
              <span className={styles.hostLabel}>호스트:</span>
              <span className={styles.hostName}>
                {accommodation.host.nickname} 님
              </span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          {accommodation.description && (
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
