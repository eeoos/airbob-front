import type {
  ListingEditorAccommodation,
  ListingEditorImage,
  ListingEditorUpdateInput,
} from "../model/listingEditor";
import type {
  ListingEditorAccommodationWire,
  ListingEditorImageWire,
  ListingEditorUpdateWire,
} from "./listingEditorContracts";

export const toListingEditorImage = (
  wire: ListingEditorImageWire,
): ListingEditorImage => ({
  id: wire.id,
  imageUrl: wire.image_url,
});

export const toListingEditorAccommodation = (
  wire: ListingEditorAccommodationWire,
): ListingEditorAccommodation => ({
  id: wire.id,
  name: wire.name,
  description: wire.description,
  type: wire.type,
  basePrice: wire.base_price,
  currency: wire.currency,
  checkInTime: wire.check_in_time,
  checkOutTime: wire.check_out_time,
  address: wire.address
    ? {
        postalCode: wire.address.postal_code,
        country: wire.address.country,
        state: wire.address.state,
        city: wire.address.city,
        district: wire.address.district,
        street: wire.address.street,
        detail: wire.address.detail,
      }
    : null,
  occupancyPolicy: wire.policy
    ? {
        maxOccupancy: wire.policy.max_occupancy,
        infantOccupancy: wire.policy.infant_occupancy,
        petOccupancy: wire.policy.pet_occupancy,
      }
    : null,
  amenities: wire.amenities.map((amenity) => ({
    name: amenity.type,
    count: amenity.count,
  })),
  images: wire.images.map(toListingEditorImage),
});

export const toListingEditorUpdateWire = (
  input: ListingEditorUpdateInput,
): ListingEditorUpdateWire => ({
  ...(input.name !== undefined ? { name: input.name } : {}),
  ...(input.description !== undefined
    ? { description: input.description }
    : {}),
  ...(input.basePrice !== undefined ? { base_price: input.basePrice } : {}),
  ...(input.currency !== undefined ? { currency: input.currency } : {}),
  ...(input.address !== undefined
    ? {
        address_info: {
          postal_code: input.address.postalCode,
          country: input.address.country,
          ...(input.address.state !== undefined
            ? { state: input.address.state }
            : {}),
          city: input.address.city,
          ...(input.address.district !== undefined
            ? { district: input.address.district }
            : {}),
          street: input.address.street,
          ...(input.address.detail !== undefined
            ? { detail: input.address.detail }
            : {}),
        },
      }
    : {}),
  ...(input.amenities !== undefined
    ? {
        amenity_infos: input.amenities.map((amenity) => ({
          name: amenity.name,
          count: amenity.count,
        })),
      }
    : {}),
  ...(input.occupancyPolicy !== undefined
    ? {
        occupancy_policy_info: {
          max_occupancy: input.occupancyPolicy.maxOccupancy,
          infant_occupancy: input.occupancyPolicy.infantOccupancy,
          pet_occupancy: input.occupancyPolicy.petOccupancy,
        },
      }
    : {}),
  ...(input.type !== undefined ? { type: input.type } : {}),
  ...(input.checkInTime !== undefined
    ? { check_in_time: input.checkInTime }
    : {}),
  ...(input.checkOutTime !== undefined
    ? { check_out_time: input.checkOutTime }
    : {}),
});
