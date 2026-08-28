import { getPublicRuntimeConfig } from "../../../platform/config/publicRuntimeConfig";
import { buildGoogleMapsEmbedUrl } from "../../../platform/integrations/googleMaps";
import type { AccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import styles from "./AccommodationLocationSection.module.css";

interface AccommodationLocationSectionProps {
  detailView: AccommodationDetailViewModel;
  googleMapsApiKey?: string;
}

export function AccommodationLocationSection({
  detailView,
  googleMapsApiKey =
    getPublicRuntimeConfig().googleMapsBrowserKey ?? "",
}: AccommodationLocationSectionProps) {
  const { latitude, longitude } = detailView.coordinate;
  const hasCoordinates = Boolean(latitude && longitude);
  const mapUrl = hasCoordinates
    ? buildGoogleMapsEmbedUrl({
        apiKey: googleMapsApiKey,
        latitude: latitude!,
        longitude: longitude!,
        zoom: 15,
      })
    : null;

  return (
    <section className={`${styles.section} ${styles.locationSectionFullWidth}`}>
      <h2 className={styles.sectionTitle}>위치</h2>
      <p className={styles.address}>
        {detailView.locationLabel}
      </p>
      {hasCoordinates && (
        <div className={styles.mapContainer}>
          {mapUrl ? (
            <iframe
              title="숙소 위치 지도"
              width="100%"
              height="100%"
              loading="lazy"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              src={mapUrl}
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
