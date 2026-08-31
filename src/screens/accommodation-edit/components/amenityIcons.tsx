import { Icon } from "../../../shared/ui/Icon";
import { accommodationEditAmenityIconRegistry } from "./amenityIconRegistry";

export const AmenityIcon = ({ type }: { type: string }) => (
  <Icon
    decorative
    glyph={accommodationEditAmenityIconRegistry.resolve(type)}
    size="100%"
    strokeWidth="1.5"
  />
);
