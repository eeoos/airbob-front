import type {
  ListingEditorAccommodation,
  ListingEditorUpdateInput,
} from "./listingEditor";

export type ListingEditorStep = 1 | 2 | 3 | 4 | 5;

export interface ListingEditorFormData {
  readonly name: string;
  readonly description: string;
  readonly basePrice: string;
  readonly type: string;
  readonly checkInTime: string;
  readonly checkOutTime: string;
  readonly addressInfo: {
    readonly postalCode: string;
    readonly city: string;
    readonly state: string;
    readonly country: string;
    readonly detail: string;
    readonly district: string;
    readonly street: string;
  };
  readonly occupancyPolicyInfo: {
    readonly maxOccupancy: string;
    readonly infantOccupancy: boolean;
    readonly petOccupancy: boolean;
  };
  readonly amenityInfos: readonly {
    readonly name: string;
    readonly count: number;
  }[];
}

export interface ListingEditorFallbackProvenance {
  readonly checkInTime: boolean;
  readonly checkOutTime: boolean;
  readonly occupancyPolicy: boolean;
}

interface StepCompletionOptions {
  readonly imageCount: number;
  readonly isNewDraft: boolean;
}

const cloneAmenities = (
  amenities: ListingEditorFormData["amenityInfos"],
): ListingEditorFormData["amenityInfos"] =>
  amenities.map((amenity) => ({ ...amenity }));

export const createDefaultListingEditorFormData =
  (): ListingEditorFormData => ({
    name: "",
    description: "",
    basePrice: "",
    type: "",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    addressInfo: {
      postalCode: "",
      city: "",
      state: "",
      country: "대한민국",
      detail: "",
      district: "",
      street: "",
    },
    occupancyPolicyInfo: {
      maxOccupancy: "1",
      infantOccupancy: false,
      petOccupancy: false,
    },
    amenityInfos: [],
  });

export const cloneListingEditorFormData = (
  formData: ListingEditorFormData,
): ListingEditorFormData => ({
  ...formData,
  addressInfo: { ...formData.addressInfo },
  occupancyPolicyInfo: { ...formData.occupancyPolicyInfo },
  amenityInfos: cloneAmenities(formData.amenityInfos),
});

export const toListingEditorFormData = (
  accommodation: ListingEditorAccommodation,
): ListingEditorFormData => ({
  name: accommodation.name ?? "",
  description: accommodation.description ?? "",
  basePrice:
    accommodation.basePrice === null ? "" : String(accommodation.basePrice),
  type: accommodation.type ?? "",
  checkInTime: accommodation.checkInTime ?? "15:00",
  checkOutTime: accommodation.checkOutTime ?? "11:00",
  addressInfo: {
    postalCode: accommodation.address?.postalCode ?? "",
    city: accommodation.address?.city ?? "",
    state: accommodation.address?.state ?? "",
    country: accommodation.address?.country ?? "대한민국",
    detail: accommodation.address?.detail ?? "",
    district: accommodation.address?.district ?? "",
    street: accommodation.address?.street ?? "",
  },
  occupancyPolicyInfo: {
    maxOccupancy: String(accommodation.occupancyPolicy?.maxOccupancy ?? 1),
    infantOccupancy: (accommodation.occupancyPolicy?.infantOccupancy ?? 0) > 0,
    petOccupancy: (accommodation.occupancyPolicy?.petOccupancy ?? 0) > 0,
  },
  amenityInfos: cloneAmenities(accommodation.amenities),
});

export const getListingEditorFallbackProvenance = (
  accommodation: ListingEditorAccommodation,
): ListingEditorFallbackProvenance => ({
  checkInTime: accommodation.checkInTime === null,
  checkOutTime: accommodation.checkOutTime === null,
  occupancyPolicy: accommodation.occupancyPolicy === null,
});

export const hasListingEditorDetailAddress = (
  formData: ListingEditorFormData,
): boolean => Boolean(formData.addressInfo.detail.trim());

const sortedAmenities = (amenities: ListingEditorFormData["amenityInfos"]) =>
  [...amenities]
    .map((amenity) => ({ ...amenity }))
    .sort((left, right) => left.name.localeCompare(right.name));

const amenitiesChanged = (
  current: ListingEditorFormData["amenityInfos"],
  baseline: ListingEditorFormData["amenityInfos"],
): boolean =>
  JSON.stringify(sortedAmenities(current)) !==
  JSON.stringify(sortedAmenities(baseline));

const addressChanged = (
  current: ListingEditorFormData["addressInfo"],
  baseline: ListingEditorFormData["addressInfo"],
): boolean =>
  (Object.keys(current) as Array<keyof typeof current>).some(
    (key) => current[key] !== baseline[key],
  );

const occupancyChanged = (
  current: ListingEditorFormData["occupancyPolicyInfo"],
  baseline: ListingEditorFormData["occupancyPolicyInfo"],
): boolean =>
  current.maxOccupancy !== baseline.maxOccupancy ||
  current.infantOccupancy !== baseline.infantOccupancy ||
  current.petOccupancy !== baseline.petOccupancy;

const toCompleteAddress = (
  address: ListingEditorFormData["addressInfo"],
): ListingEditorUpdateInput["address"] | undefined => {
  const postalCode = address.postalCode.trim();
  const country = address.country.trim();
  const city = address.city.trim();
  const street = address.street.trim();

  if (!postalCode || !country || !city || !street) return undefined;

  const state = address.state.trim();
  const district = address.district.trim();
  const detail = address.detail.trim();

  return {
    postalCode,
    country,
    city,
    street,
    ...(state ? { state } : {}),
    ...(district ? { district } : {}),
    ...(detail ? { detail } : {}),
  };
};

const toOccupancyPolicy = (
  policy: ListingEditorFormData["occupancyPolicyInfo"],
): NonNullable<ListingEditorUpdateInput["occupancyPolicy"]> => ({
  maxOccupancy: Number(policy.maxOccupancy),
  infantOccupancy: policy.infantOccupancy ? 1 : 0,
  petOccupancy: policy.petOccupancy ? 1 : 0,
});

export const buildListingEditorUpdate = ({
  formData,
  baseline,
  fallbackProvenance = {
    checkInTime: false,
    checkOutTime: false,
    occupancyPolicy: false,
  },
}: {
  readonly formData: ListingEditorFormData;
  readonly baseline: ListingEditorFormData;
  readonly fallbackProvenance?: ListingEditorFallbackProvenance;
}): ListingEditorUpdateInput => {
  const update: {
    -readonly [
      Key in keyof ListingEditorUpdateInput
    ]?: ListingEditorUpdateInput[Key];
  } = {};

  if (formData.name !== baseline.name) update.name = formData.name;
  if (formData.description !== baseline.description) {
    update.description = formData.description;
  }
  if (formData.basePrice !== baseline.basePrice) {
    update.basePrice = Number(formData.basePrice);
    update.currency = "KRW";
  }
  if (formData.type !== baseline.type) update.type = formData.type;
  if (
    fallbackProvenance.checkInTime ||
    formData.checkInTime !== baseline.checkInTime
  ) {
    update.checkInTime = formData.checkInTime;
  }
  if (
    fallbackProvenance.checkOutTime ||
    formData.checkOutTime !== baseline.checkOutTime
  ) {
    update.checkOutTime = formData.checkOutTime;
  }
  if (addressChanged(formData.addressInfo, baseline.addressInfo)) {
    const address = toCompleteAddress(formData.addressInfo);
    if (address) update.address = address;
  }
  if (
    fallbackProvenance.occupancyPolicy ||
    occupancyChanged(formData.occupancyPolicyInfo, baseline.occupancyPolicyInfo)
  ) {
    update.occupancyPolicy = toOccupancyPolicy(formData.occupancyPolicyInfo);
  }
  if (amenitiesChanged(formData.amenityInfos, baseline.amenityInfos)) {
    update.amenities = sortedAmenities(formData.amenityInfos);
  }

  return update;
};

export const isListingEditorStepCompleted = (
  formData: ListingEditorFormData,
  step: ListingEditorStep,
  { imageCount, isNewDraft }: StepCompletionOptions,
): boolean => {
  const locationComplete = Boolean(formData.addressInfo.street.trim());
  const photosComplete = imageCount >= 1;
  const infoComplete = Boolean(
    formData.name &&
    formData.description &&
    formData.basePrice &&
    formData.type &&
    formData.occupancyPolicyInfo.maxOccupancy,
  );
  const timeComplete = Boolean(formData.checkInTime && formData.checkOutTime);
  const draftTimeComplete = isNewDraft
    ? locationComplete && photosComplete && infoComplete && timeComplete
    : timeComplete;

  switch (step) {
    case 1:
      return locationComplete;
    case 2:
      return photosComplete;
    case 3:
      return infoComplete;
    case 4:
      return draftTimeComplete;
    case 5:
      return locationComplete && photosComplete && infoComplete && timeComplete;
  }
};
