export interface ListingEditorAddressWire {
  readonly postal_code: string;
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
  readonly street: string;
  readonly detail: string | null;
}

export interface ListingEditorPolicyWire {
  readonly max_occupancy: number;
  readonly infant_occupancy: number;
  readonly pet_occupancy: number;
}

export interface ListingEditorAmenityWire {
  readonly type: string;
  readonly count: number;
}

export interface ListingEditorImageWire {
  readonly id: number;
  readonly image_url: string;
}

export interface ListingEditorAccommodationWire {
  readonly id: number;
  readonly name: string | null;
  readonly description: string | null;
  readonly type: string | null;
  readonly base_price: number | null;
  readonly currency: string | null;
  readonly check_in_time: string | null;
  readonly check_out_time: string | null;
  readonly address: ListingEditorAddressWire | null;
  readonly policy: ListingEditorPolicyWire | null;
  readonly amenities: readonly ListingEditorAmenityWire[];
  readonly images: readonly ListingEditorImageWire[];
}

export interface ListingEditorUpdateAddressWire {
  readonly postal_code: string;
  readonly country: string;
  readonly state?: string;
  readonly city: string;
  readonly district?: string;
  readonly street: string;
  readonly detail?: string;
}

export interface ListingEditorUpdateWire {
  readonly name?: string;
  readonly description?: string;
  readonly base_price?: number;
  readonly currency?: string;
  readonly address_info?: ListingEditorUpdateAddressWire;
  readonly amenity_infos?: readonly {
    readonly name: string;
    readonly count: number;
  }[];
  readonly occupancy_policy_info?: {
    readonly max_occupancy: number;
    readonly infant_occupancy: number;
    readonly pet_occupancy: number;
  };
  readonly type?: string;
  readonly check_in_time?: string;
  readonly check_out_time?: string;
}

export interface ListingEditorUploadedImagesWire {
  readonly uploaded_images: readonly ListingEditorImageWire[];
}
