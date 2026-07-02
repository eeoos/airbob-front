import { HostAccommodationDetail } from "../../../../types/accommodation";
import {
  buildAccommodationUpdateData,
  mapHostAccommodationToEditFormData,
  toAccommodationApiUpdateData,
} from "./accommodationEditMapper";

const hostDetail = (
  overrides: Partial<HostAccommodationDetail> = {}
): HostAccommodationDetail => ({
  id: 1,
  name: "기존 숙소",
  description: "기존 설명",
  type: "ENTIRE_PLACE",
  base_price: 120000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  address: {
    postal_code: "12345",
    city: "Seoul",
    state: "Seoul",
    country: "대한민국",
    detail: null,
    district: "Mapo",
    street: "Worldcup-ro",
  },
  coordinate: { latitude: 37.5, longitude: 127 },
  host: { id: 1, nickname: "Host", thumbnail_image_url: null },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 0,
  },
  amenities: [
    { type: "WIFI", count: 1 },
    { type: "TV", count: 2 },
  ],
  images: [],
  review_summary: { total_count: 0, average_rating: 0 },
  ...overrides,
});

describe("accommodation edit mapper", () => {
  it("maps host accommodation detail into edit form data with UI defaults", () => {
    expect(mapHostAccommodationToEditFormData(hostDetail())).toEqual({
      name: "기존 숙소",
      description: "기존 설명",
      basePrice: "120000",
      type: "ENTIRE_PLACE",
      checkInTime: "15:00:00",
      checkOutTime: "11:00:00",
      addressInfo: {
        postalCode: "12345",
        city: "Seoul",
        state: "Seoul",
        country: "대한민국",
        detail: "",
        district: "Mapo",
        street: "Worldcup-ro",
      },
      occupancyPolicyInfo: {
        maxOccupancy: "4",
        infantOccupancy: true,
        petOccupancy: false,
      },
      amenityInfos: [
        { name: "WIFI", count: 1 },
        { name: "TV", count: 2 },
      ],
    });
  });

  it("builds draft update data with only entered fields", () => {
    const data = buildAccommodationUpdateData({
      isDraft: true,
      formData: {
        ...mapHostAccommodationToEditFormData(hostDetail({ name: null })),
        name: " 새 숙소 ",
        description: "",
        basePrice: "150000",
        type: "PRIVATE_ROOM",
        addressInfo: {
          postalCode: "",
          city: "Seoul",
          state: "",
          country: "대한민국",
          detail: "",
          district: "",
          street: "Hongdae-ro",
        },
        amenityInfos: [],
      },
    });

    expect(data).toEqual({
      name: " 새 숙소 ",
      base_price: 150000,
      currency: "KRW",
      type: "PRIVATE_ROOM",
      check_in_time: "15:00:00",
      check_out_time: "11:00:00",
      address_info: {
        city: "Seoul",
        street: "Hongdae-ro",
        country: "대한민국",
      },
      occupancy_policy_info: {
        max_occupancy: 4,
        infant_occupancy: 1,
        pet_occupancy: 0,
      },
    });
  });

  it("builds edit update data with only changed fields", () => {
    const initialFormData = mapHostAccommodationToEditFormData(hostDetail());
    const formData = {
      ...initialFormData,
      basePrice: "130000",
      addressInfo: {
        ...initialFormData.addressInfo,
        detail: "101호",
      },
      occupancyPolicyInfo: {
        ...initialFormData.occupancyPolicyInfo,
        petOccupancy: true,
      },
      amenityInfos: [
        { name: "TV", count: 2 },
        { name: "WIFI", count: 1 },
      ],
    };

    expect(
      buildAccommodationUpdateData({
        isDraft: false,
        formData,
        initialFormData,
      })
    ).toEqual({
      base_price: 130000,
      currency: "KRW",
      address_info: {
        postal_code: "12345",
        city: "Seoul",
        state: "Seoul",
        country: "대한민국",
        detail: "101호",
        district: "Mapo",
        street: "Worldcup-ro",
      },
      occupancy_policy_info: {
        max_occupancy: 4,
        infant_occupancy: 1,
        pet_occupancy: 1,
      },
    });
  });

  it("normalizes update data to the API contract before PATCH", () => {
    expect(
      toAccommodationApiUpdateData({
        name: "주소 일부 누락 숙소",
        address_info: {
          city: "Seoul",
          country: "대한민국",
          street: "Hongdae-ro",
        },
      })
    ).toEqual({
      name: "주소 일부 누락 숙소",
    });

    expect(
      toAccommodationApiUpdateData({
        address_info: {
          postal_code: "12345",
          city: "Seoul",
          country: "대한민국",
          street: "Hongdae-ro",
          detail: "101호",
        },
      })
    ).toEqual({
      address_info: {
        postal_code: "12345",
        city: "Seoul",
        country: "대한민국",
        street: "Hongdae-ro",
        detail: "101호",
      },
    });
  });
});
