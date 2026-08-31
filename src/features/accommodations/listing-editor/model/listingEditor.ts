export interface ListingEditorImage {
  readonly id: number;
  readonly imageUrl: string;
}

interface ListingEditorAddress {
  readonly postalCode: string;
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
  readonly street: string;
  readonly detail: string | null;
}

interface ListingEditorOccupancyPolicy {
  readonly maxOccupancy: number;
  readonly infantOccupancy: number;
  readonly petOccupancy: number;
}

interface ListingEditorAmenity {
  readonly name: string;
  readonly count: number;
}

export interface ListingEditorAccommodation {
  readonly id: number;
  readonly name: string | null;
  readonly description: string | null;
  readonly type: string | null;
  readonly basePrice: number | null;
  readonly currency: string | null;
  readonly checkInTime: string | null;
  readonly checkOutTime: string | null;
  readonly address: ListingEditorAddress | null;
  readonly occupancyPolicy: ListingEditorOccupancyPolicy | null;
  readonly amenities: readonly ListingEditorAmenity[];
  readonly images: readonly ListingEditorImage[];
}

interface ListingEditorUpdateAddress {
  readonly postalCode: string;
  readonly country: string;
  readonly state?: string;
  readonly city: string;
  readonly district?: string;
  readonly street: string;
  readonly detail?: string;
}

export interface ListingEditorUpdateInput {
  readonly name?: string;
  readonly description?: string;
  readonly basePrice?: number;
  readonly currency?: string;
  readonly address?: ListingEditorUpdateAddress;
  readonly amenities?: readonly ListingEditorAmenity[];
  readonly occupancyPolicy?: ListingEditorOccupancyPolicy;
  readonly type?: string;
  readonly checkInTime?: string;
  readonly checkOutTime?: string;
}
