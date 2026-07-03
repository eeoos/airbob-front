import { HostAccommodationDetail } from "../../../../types/accommodation";
import {
  AccommodationEditAmenityInfo,
  areAmenityInfosChanged,
} from "./accommodationEditDirty";

export interface AccommodationEditFormData {
  name: string;
  description: string;
  basePrice: string;
  type: string;
  checkInTime: string;
  checkOutTime: string;
  addressInfo: {
    postalCode: string;
    city: string;
    state: string;
    country: string;
    detail: string;
    district: string;
    street: string;
  };
  occupancyPolicyInfo: {
    maxOccupancy: string;
    infantOccupancy: boolean;
    petOccupancy: boolean;
  };
  amenityInfos: AccommodationEditAmenityInfo[];
}

export interface AccommodationEditUpdateData {
  name?: string;
  description?: string;
  base_price?: number;
  currency?: string;
  address_info?: {
    postal_code?: string;
    country?: string;
    state?: string;
    city?: string;
    district?: string;
    street?: string;
    detail?: string;
  };
  amenity_infos?: AccommodationEditAmenityInfo[];
  occupancy_policy_info?: {
    max_occupancy: number;
    infant_occupancy: number;
    pet_occupancy: number;
  };
  type?: string;
  check_in_time?: string;
  check_out_time?: string;
}

export type AccommodationApiUpdateData = Omit<
  AccommodationEditUpdateData,
  "address_info"
> & {
  address_info?: {
    postal_code: string;
    country: string;
    state?: string;
    city: string;
    district?: string;
    street: string;
    detail?: string;
  };
};

interface BuildAccommodationUpdateDataOptions {
  isDraft: boolean;
  formData: AccommodationEditFormData;
  initialFormData?: AccommodationEditFormData | null;
}

export const createDefaultAccommodationEditFormData =
  (): AccommodationEditFormData => ({
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

export const mapHostAccommodationToEditFormData = (
  data: HostAccommodationDetail
): AccommodationEditFormData => ({
  name: data.name || "",
  description: data.description || "",
  basePrice: String(data.base_price || ""),
  type: data.type || "",
  checkInTime: data.check_in_time || "15:00",
  checkOutTime: data.check_out_time || "11:00",
  addressInfo: {
    postalCode: data.address?.postal_code || "",
    city: data.address?.city || "",
    state: data.address?.state || "",
    country: data.address?.country || "대한민국",
    detail: data.address?.detail || "",
    district: data.address?.district || "",
    street: data.address?.street || "",
  },
  occupancyPolicyInfo: {
    maxOccupancy: String(data.policy?.max_occupancy || "1"),
    infantOccupancy: (data.policy?.infant_occupancy || 0) > 0,
    petOccupancy: (data.policy?.pet_occupancy || 0) > 0,
  },
  amenityInfos:
    data.amenities?.map((amenity) => ({
      name: amenity.type,
      count: amenity.count,
    })) || [],
});

const buildDraftAddressInfo = (
  formData: AccommodationEditFormData
): AccommodationEditUpdateData["address_info"] | undefined => {
  const { addressInfo } = formData;
  const hasAddressData =
    addressInfo.postalCode ||
    addressInfo.city ||
    addressInfo.state ||
    addressInfo.district ||
    addressInfo.street ||
    addressInfo.detail;

  if (!hasAddressData) {
    return undefined;
  }

  const data: NonNullable<AccommodationEditUpdateData["address_info"]> = {};
  if (addressInfo.postalCode) data.postal_code = addressInfo.postalCode;
  if (addressInfo.city) data.city = addressInfo.city;
  if (addressInfo.state) data.state = addressInfo.state;
  if (addressInfo.district) data.district = addressInfo.district;
  if (addressInfo.street) data.street = addressInfo.street;
  if (addressInfo.detail) data.detail = addressInfo.detail;
  if (addressInfo.country) data.country = addressInfo.country;
  return data;
};

const buildTrimmedAddressInfo = (
  formData: AccommodationEditFormData
): AccommodationEditUpdateData["address_info"] => {
  const { addressInfo } = formData;
  const data: NonNullable<AccommodationEditUpdateData["address_info"]> = {};

  if (addressInfo.postalCode && addressInfo.postalCode.trim()) {
    data.postal_code = addressInfo.postalCode.trim();
  }
  if (addressInfo.city && addressInfo.city.trim()) {
    data.city = addressInfo.city.trim();
  }
  if (addressInfo.state && addressInfo.state.trim()) {
    data.state = addressInfo.state.trim();
  }
  if (addressInfo.country && addressInfo.country.trim()) {
    data.country = addressInfo.country.trim();
  }
  if (addressInfo.detail && addressInfo.detail.trim()) {
    data.detail = addressInfo.detail.trim();
  }
  if (addressInfo.district && addressInfo.district.trim()) {
    data.district = addressInfo.district.trim();
  }
  if (addressInfo.street && addressInfo.street.trim()) {
    data.street = addressInfo.street.trim();
  }

  return data;
};

const buildOccupancyPolicyInfo = (
  formData: AccommodationEditFormData
): NonNullable<AccommodationEditUpdateData["occupancy_policy_info"]> => ({
  max_occupancy: Number(formData.occupancyPolicyInfo.maxOccupancy),
  infant_occupancy: formData.occupancyPolicyInfo.infantOccupancy ? 1 : 0,
  pet_occupancy: formData.occupancyPolicyInfo.petOccupancy ? 1 : 0,
});

const hasAddressChanged = (
  formData: AccommodationEditFormData,
  initialFormData: AccommodationEditFormData
) =>
  formData.addressInfo.postalCode !== initialFormData.addressInfo.postalCode ||
  formData.addressInfo.city !== initialFormData.addressInfo.city ||
  formData.addressInfo.state !== initialFormData.addressInfo.state ||
  formData.addressInfo.country !== initialFormData.addressInfo.country ||
  formData.addressInfo.detail !== initialFormData.addressInfo.detail ||
  formData.addressInfo.district !== initialFormData.addressInfo.district ||
  formData.addressInfo.street !== initialFormData.addressInfo.street;

const hasOccupancyChanged = (
  formData: AccommodationEditFormData,
  initialFormData: AccommodationEditFormData
) =>
  formData.occupancyPolicyInfo.maxOccupancy !==
    initialFormData.occupancyPolicyInfo.maxOccupancy ||
  formData.occupancyPolicyInfo.infantOccupancy !==
    initialFormData.occupancyPolicyInfo.infantOccupancy ||
  formData.occupancyPolicyInfo.petOccupancy !==
    initialFormData.occupancyPolicyInfo.petOccupancy;

const sortAmenities = (items: AccommodationEditAmenityInfo[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

const hasCompleteAddressInfo = (
  addressInfo: NonNullable<AccommodationEditUpdateData["address_info"]>
): addressInfo is NonNullable<AccommodationApiUpdateData["address_info"]> =>
  Boolean(
    addressInfo.postal_code?.trim() &&
      addressInfo.country?.trim() &&
      addressInfo.city?.trim() &&
      addressInfo.street?.trim()
  );

export const toAccommodationApiUpdateData = (
  updateData: AccommodationEditUpdateData
): AccommodationApiUpdateData => {
  const { address_info: addressInfo, ...rest } = updateData;

  if (!addressInfo || !hasCompleteAddressInfo(addressInfo)) {
    return rest;
  }

  return {
    ...rest,
    address_info: {
      postal_code: addressInfo.postal_code,
      country: addressInfo.country,
      city: addressInfo.city,
      street: addressInfo.street,
      ...(addressInfo.state !== undefined ? { state: addressInfo.state } : {}),
      ...(addressInfo.district !== undefined
        ? { district: addressInfo.district }
        : {}),
      ...(addressInfo.detail !== undefined ? { detail: addressInfo.detail } : {}),
    },
  };
};

export const buildAccommodationUpdateData = ({
  isDraft,
  formData,
  initialFormData = null,
}: BuildAccommodationUpdateDataOptions): AccommodationEditUpdateData => {
  const data: AccommodationEditUpdateData = {};

  if (isDraft) {
    if (formData.name && formData.name.trim()) data.name = formData.name;
    if (formData.description && formData.description.trim()) {
      data.description = formData.description;
    }
    if (formData.basePrice && Number(formData.basePrice) > 0) {
      data.base_price = Number(formData.basePrice);
      data.currency = "KRW";
    }
    if (formData.type) data.type = formData.type;
    if (formData.checkInTime) data.check_in_time = formData.checkInTime;
    if (formData.checkOutTime) data.check_out_time = formData.checkOutTime;

    const addressInfo = buildDraftAddressInfo(formData);
    if (addressInfo) data.address_info = addressInfo;

    if (
      formData.occupancyPolicyInfo.maxOccupancy &&
      Number(formData.occupancyPolicyInfo.maxOccupancy) > 0
    ) {
      data.occupancy_policy_info = buildOccupancyPolicyInfo(formData);
    }
    if (formData.amenityInfos.length > 0) {
      data.amenity_infos = formData.amenityInfos;
    }
    return data;
  }

  if (!initialFormData) {
    data.name = formData.name;
    data.description = formData.description;
    data.base_price = Number(formData.basePrice);
    data.currency = "KRW";
    data.type = formData.type;
    data.check_in_time = formData.checkInTime;
    data.check_out_time = formData.checkOutTime;
    data.address_info = buildTrimmedAddressInfo(formData);
    data.occupancy_policy_info = buildOccupancyPolicyInfo(formData);
    data.amenity_infos = formData.amenityInfos;
    return data;
  }

  if (formData.name !== initialFormData.name) data.name = formData.name;
  if (formData.description !== initialFormData.description) {
    data.description = formData.description;
  }
  if (formData.basePrice !== initialFormData.basePrice) {
    data.base_price = Number(formData.basePrice);
    data.currency = "KRW";
  }
  if (formData.type !== initialFormData.type) data.type = formData.type;
  if (formData.checkInTime !== initialFormData.checkInTime) {
    data.check_in_time = formData.checkInTime;
  }
  if (formData.checkOutTime !== initialFormData.checkOutTime) {
    data.check_out_time = formData.checkOutTime;
  }
  if (hasAddressChanged(formData, initialFormData)) {
    data.address_info = buildTrimmedAddressInfo(formData);
  }
  if (hasOccupancyChanged(formData, initialFormData)) {
    data.occupancy_policy_info = buildOccupancyPolicyInfo(formData);
  }
  if (areAmenityInfosChanged(formData.amenityInfos, initialFormData.amenityInfos)) {
    data.amenity_infos = sortAmenities(formData.amenityInfos);
  }

  return data;
};
