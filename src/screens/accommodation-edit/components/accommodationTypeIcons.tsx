import React from "react";
import { IconFrame } from "./editStepIcons";

export const AccommodationTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case "ENTIRE_PLACE":
      return (
        <IconFrame>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </IconFrame>
      );
    case "PRIVATE_ROOM":
      return (
        <IconFrame>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </IconFrame>
      );
    case "SHARED_ROOM":
      return (
        <IconFrame>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </IconFrame>
      );
    case "HOTEL_ROOM":
      return (
        <IconFrame>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="3" y1="16" x2="21" y2="16" />
        </IconFrame>
      );
    case "HOSTEL":
      return (
        <IconFrame>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="3" y1="16" x2="21" y2="16" />
          <line x1="9" y1="4" x2="9" y2="20" />
          <line x1="15" y1="4" x2="15" y2="20" />
        </IconFrame>
      );
    case "VILLA":
      return (
        <IconFrame>
          <path d="M3 21l9-9 9 9" />
          <path d="M3 12h18" />
          <path d="M12 3v18" />
        </IconFrame>
      );
    case "GUESTHOUSE":
      return (
        <IconFrame>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
          <circle cx="12" cy="8" r="2" />
        </IconFrame>
      );
    case "BNB":
      return (
        <IconFrame>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <circle cx="8" cy="7" r="1" />
          <circle cx="16" cy="7" r="1" />
        </IconFrame>
      );
    case "RESORT":
      return (
        <IconFrame>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
          <path d="M6 12h12" />
        </IconFrame>
      );
    case "APARTMENT":
      return (
        <IconFrame>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="3" y1="16" x2="21" y2="16" />
          <line x1="9" y1="4" x2="9" y2="20" />
          <line x1="15" y1="4" x2="15" y2="20" />
        </IconFrame>
      );
    case "HOUSE":
      return (
        <IconFrame>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </IconFrame>
      );
    case "TENT":
      return (
        <IconFrame>
          <path d="M3 21l9-9 9 9" />
          <path d="M3 12h18" />
        </IconFrame>
      );
    case "BOAT":
      return (
        <IconFrame>
          <path d="M3 18h18l-2-8H5l-2 8z" />
          <path d="M3 18l2-4h14l2 4" />
          <circle cx="7" cy="18" r="1" />
          <circle cx="17" cy="18" r="1" />
        </IconFrame>
      );
    case "TREEHOUSE":
      return (
        <IconFrame>
          <path d="M12 2v20" />
          <path d="M12 2l-4 4h8l-4-4z" />
          <path d="M8 6l-2 2h12l-2-2" />
          <rect x="6" y="8" width="12" height="8" rx="1" />
        </IconFrame>
      );
    case "CAMPER_VAN":
      return (
        <IconFrame>
          <rect x="3" y="8" width="18" height="10" rx="2" />
          <path d="M3 12h18" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
          <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
        </IconFrame>
      );
    case "CASTLE":
      return (
        <IconFrame>
          <rect x="3" y="8" width="18" height="12" rx="1" />
          <path d="M3 8l3-3h12l3 3" />
          <line x1="9" y1="8" x2="9" y2="20" />
          <line x1="15" y1="8" x2="15" y2="20" />
          <path d="M3 8l3 3-3 3" />
          <path d="M21 8l-3 3 3 3" />
        </IconFrame>
      );
    default:
      return (
        <IconFrame>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </IconFrame>
      );
  }
};
