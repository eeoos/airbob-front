import React from "react";
import { useNavigate } from "react-router-dom";
import { getImageUrl } from "../../utils/image";
import styles from "./BaseAccommodationCard.module.css";

interface BaseAccommodationCardProps {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  locationSummary: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export const BaseAccommodationCard: React.FC<BaseAccommodationCardProps> = ({
  id,
  name,
  thumbnailUrl,
  locationSummary,
  onClick,
  children,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/accommodations/${id}`);
    }
  };

  return (
    <div className={styles.card} onClick={handleClick}>
      <div className={styles.imageContainer}>
        {thumbnailUrl ? (
          <img
            src={getImageUrl(thumbnailUrl)}
            alt={name}
            className={styles.image}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder-image.png";
            }}
          />
        ) : (
          <div className={styles.placeholderImage}>이미지 없음</div>
        )}
      </div>
      <div className={styles.content}>
        <div className={styles.location}>{locationSummary}</div>
        <div className={styles.name}>{name}</div>
        {children}
      </div>
    </div>
  );
};





