import { AccommodationDetail } from "../../../types/accommodation";
import { GOOGLE_MAPS_API_KEY } from "../../../utils/constants";
import styles from "./AccommodationLocationSection.module.css";

interface AccommodationLocationSectionProps {
  accommodation: AccommodationDetail;
  googleMapsApiKey?: string;
}

export function AccommodationLocationSection({
  accommodation,
  googleMapsApiKey = GOOGLE_MAPS_API_KEY,
}: AccommodationLocationSectionProps) {
  const { latitude, longitude } = accommodation.coordinate;
  const hasCoordinates = Boolean(latitude && longitude);

  return (
    <section className={`${styles.section} ${styles.locationSectionFullWidth}`}>
      <h2 className={styles.sectionTitle}>위치</h2>
      <p className={styles.address}>
        {[accommodation.address_summary.city, accommodation.address_summary.country]
          .filter(Boolean)
          .join(", ")}
      </p>
      {hasCoordinates && (
        <div className={styles.mapContainer}>
          {googleMapsApiKey ? (
            <iframe
              title="숙소 위치 지도"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${latitude},${longitude}&zoom=15`}
            />
          ) : (
            <div className={styles.mapPlaceholder}>
              지도 (위도: {latitude}, 경도: {longitude})
            </div>
          )}
        </div>
      )}
    </section>
  );
}
