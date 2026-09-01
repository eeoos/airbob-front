import type { IconGlyph } from "../../../../shared/ui/Icon";
import {
  defineIconRegistry,
  pictogramGlyphs,
} from "../../../../shared/ui/Icon";

const accommodationAmenityGlyphs = {
  WIFI: pictogramGlyphs.wifi,
  AIR_CONDITIONER: pictogramGlyphs.airConditioner,
  HEATING: pictogramGlyphs.heating,
  KITCHEN: pictogramGlyphs.kitchen,
  WASHER: pictogramGlyphs.washer,
  DRYER: pictogramGlyphs.dryer,
  PARKING: pictogramGlyphs.parking,
  TV: pictogramGlyphs.television,
  POOL: pictogramGlyphs.pool,
  GYM: pictogramGlyphs.gym,
  HAIR_DRYER: pictogramGlyphs.hairDryer,
  IRON: pictogramGlyphs.iron,
  SHAMPOO: pictogramGlyphs.shampoo,
  BED_LINENS: pictogramGlyphs.bedLinens,
  EXTRA_PILLOWS: pictogramGlyphs.extraPillows,
  CRIB: pictogramGlyphs.crib,
  HIGH_CHAIR: pictogramGlyphs.highChair,
  DISHWASHER: pictogramGlyphs.dishwasher,
  COFFEE_MACHINE: pictogramGlyphs.coffeeMachine,
  MICROWAVE: pictogramGlyphs.microwave,
  REFRIGERATOR: pictogramGlyphs.refrigerator,
  ELEVATOR: pictogramGlyphs.elevator,
  HOT_TUB: pictogramGlyphs.hotTub,
  SMOKE_ALARM: pictogramGlyphs.alertCircle,
  CARBON_MONOXIDE_ALARM: pictogramGlyphs.alertCircle,
  FIRE_EXTINGUISHER: pictogramGlyphs.fireExtinguisher,
  PETS_ALLOWED: pictogramGlyphs.pet,
  OUTDOOR_SPACE: pictogramGlyphs.stackedLayers,
  BBQ_GRILL: pictogramGlyphs.barbecueGrill,
  BALCONY: pictogramGlyphs.balcony,
} as const satisfies Readonly<Record<string, IconGlyph>>;

export const accommodationAmenityIconRegistry = defineIconRegistry(
  accommodationAmenityGlyphs,
  pictogramGlyphs.alertCircle,
);
