import { Icon } from "../../../../shared/ui/Icon";
import { accommodationAmenityIconRegistry } from "./amenityIconRegistry";

interface AmenityIconProps {
  type: string;
  decorative?: boolean;
  label?: string;
}

const AmenityIcon = ({ type, decorative = false, label }: AmenityIconProps) => {
  const glyph = accommodationAmenityIconRegistry.resolve(type);

  if (decorative) {
    return (
      <Icon
        decorative
        glyph={glyph}
        size={24}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  return (
    <Icon
      decorative={false}
      glyph={glyph}
      label={label ?? type}
      size={24}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
};

export default AmenityIcon;
