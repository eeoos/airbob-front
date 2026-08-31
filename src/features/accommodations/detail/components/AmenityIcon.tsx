import { Icon } from "../../../../shared/ui/Icon";
import { accommodationAmenityIconRegistry } from "./amenityIconRegistry";

interface AmenityIconProps {
  type: string;
  decorative?: boolean;
}

const AmenityIcon = ({ type, decorative = false }: AmenityIconProps) => {
  const glyph = accommodationAmenityIconRegistry.resolve(type);

  if (decorative) {
    return <Icon decorative glyph={glyph} size={24} />;
  }

  return <Icon decorative={false} glyph={glyph} label={type} size={24} />;
};

export default AmenityIcon;
