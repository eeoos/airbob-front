import React from "react";
import { IconFrame } from "./editStepIcons";

export const AmenityIcon: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case "WIFI":
      return (
        <IconFrame>
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </IconFrame>
      );
    case "AIR_CONDITIONER":
      return (
        <IconFrame>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <circle cx="8" cy="6" r="1" />
          <circle cx="16" cy="6" r="1" />
        </IconFrame>
      );
    case "HEATING":
      return (
        <IconFrame>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </IconFrame>
      );
    case "KITCHEN":
      return (
        <IconFrame>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <circle cx="15" cy="15" r="2" />
        </IconFrame>
      );
    case "WASHER":
      return (
        <IconFrame>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
        </IconFrame>
      );
    case "DRYER":
      return (
        <IconFrame>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="12" cy="12" r="4" />
        </IconFrame>
      );
    case "PARKING":
      return (
        <IconFrame>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8h10M7 12h10M7 16h6" />
        </IconFrame>
      );
    case "TV":
      return (
        <IconFrame>
          <rect x="2" y="7" width="20" height="12" rx="2" />
          <path d="M17 2l-5 5-5-5" />
        </IconFrame>
      );
    case "HAIR_DRYER":
      return (
        <IconFrame>
          <path d="M18 12h-6M12 6v12" />
          <circle cx="12" cy="12" r="2" />
        </IconFrame>
      );
    case "IRON":
      return (
        <IconFrame>
          <path d="M3 12h18M12 3v18" />
          <path d="M6 6l12 12M18 6L6 18" />
        </IconFrame>
      );
    case "SHAMPOO":
      return (
        <IconFrame>
          <rect x="8" y="2" width="8" height="20" rx="2" />
          <path d="M8 6h8M8 10h8" />
        </IconFrame>
      );
    case "BED_LINENS":
      return (
        <IconFrame>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <path d="M3 12h18M3 16h18" />
        </IconFrame>
      );
    case "EXTRA_PILLOWS":
      return (
        <IconFrame>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M8 10h8M8 14h8" />
        </IconFrame>
      );
    case "CRIB":
      return (
        <IconFrame>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 12h18" />
        </IconFrame>
      );
    case "HIGH_CHAIR":
      return (
        <IconFrame>
          <rect x="6" y="4" width="12" height="16" rx="2" />
          <path d="M6 8h12M6 12h12" />
          <path d="M9 20v-4M15 20v-4" />
        </IconFrame>
      );
    case "DISHWASHER":
      return (
        <IconFrame>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M3 8h18M3 16h18" />
        </IconFrame>
      );
    case "COFFEE_MACHINE":
      return (
        <IconFrame>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 8h8M8 12h8" />
          <circle cx="12" cy="16" r="2" />
        </IconFrame>
      );
    case "MICROWAVE":
      return (
        <IconFrame>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M3 16h18" />
          <circle cx="12" cy="13" r="2" />
        </IconFrame>
      );
    case "REFRIGERATOR":
      return (
        <IconFrame>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M4 8h16M4 14h16" />
          <circle cx="8" cy="11" r="1" />
        </IconFrame>
      );
    case "ELEVATOR":
      return (
        <IconFrame>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M5 8h14M5 16h14" />
          <circle cx="12" cy="12" r="2" />
        </IconFrame>
      );
    case "POOL":
      return (
        <IconFrame>
          <path d="M3 12h18M3 16h18M3 8h18" />
          <circle cx="6" cy="12" r="2" />
          <circle cx="18" cy="12" r="2" />
        </IconFrame>
      );
    case "HOT_TUB":
      return (
        <IconFrame>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </IconFrame>
      );
    case "GYM":
      return (
        <IconFrame>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 3v18M3 12h18" />
          <circle cx="8" cy="8" r="1" />
          <circle cx="16" cy="16" r="1" />
        </IconFrame>
      );
    case "SMOKE_ALARM":
    case "CARBON_MONOXIDE_ALARM":
      return (
        <IconFrame>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </IconFrame>
      );
    case "FIRE_EXTINGUISHER":
      return (
        <IconFrame>
          <rect x="8" y="2" width="8" height="18" rx="2" />
          <path d="M8 6h8M8 10h8" />
          <circle cx="12" cy="16" r="2" />
        </IconFrame>
      );
    case "PETS_ALLOWED":
      return (
        <IconFrame>
          <circle cx="9" cy="9" r="3" />
          <circle cx="15" cy="9" r="3" />
          <path d="M9 12v6M15 12v6" />
          <path d="M6 15h12" />
        </IconFrame>
      );
    case "OUTDOOR_SPACE":
      return (
        <IconFrame>
          <path d="M3 12h18M12 3v18" />
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="6" cy="18" r="2" />
        </IconFrame>
      );
    case "BBQ_GRILL":
      return (
        <IconFrame>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18M3 14h18" />
          <circle cx="8" cy="12" r="1" />
          <circle cx="16" cy="12" r="1" />
        </IconFrame>
      );
    case "BALCONY":
      return (
        <IconFrame>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <path d="M3 12h18M3 16h18" />
          <path d="M6 20v-4M18 20v-4" />
        </IconFrame>
      );
    default:
      return (
        <IconFrame>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 3v18" />
        </IconFrame>
      );
  }
};
