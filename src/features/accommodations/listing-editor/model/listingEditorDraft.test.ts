import type { ListingEditorAccommodation } from "./listingEditor";
import {
  buildListingEditorUpdate,
  cloneListingEditorFormData,
  getListingEditorFallbackProvenance,
  isListingEditorStepCompleted,
  toListingEditorFormData,
} from "./listingEditorDraft";

const accommodation = (
  overrides: Partial<ListingEditorAccommodation> = {},
): ListingEditorAccommodation => ({
  id: 1,
  name: "기존 숙소",
  description: "기존 설명",
  type: "ENTIRE_PLACE",
  basePrice: 120_000,
  currency: "KRW",
  checkInTime: "15:00:00",
  checkOutTime: "11:00:00",
  address: {
    postalCode: "12345",
    city: "Seoul",
    state: "Seoul",
    country: "대한민국",
    detail: "101호",
    district: "Mapo",
    street: "Worldcup-ro",
  },
  occupancyPolicy: {
    maxOccupancy: 4,
    infantOccupancy: 1,
    petOccupancy: 0,
  },
  amenities: [
    { name: "WIFI", count: 1 },
    { name: "TV", count: 2 },
  ],
  images: [],
  ...overrides,
});

describe("listing editor draft model", () => {
  it("maps the owned host model into an isolated working form", () => {
    const source = accommodation();
    const form = toListingEditorFormData(source);

    expect(form).toMatchObject({
      name: "기존 숙소",
      basePrice: "120000",
      addressInfo: { detail: "101호", street: "Worldcup-ro" },
      occupancyPolicyInfo: {
        maxOccupancy: "4",
        infantOccupancy: true,
        petOccupancy: false,
      },
    });
    expect(form.amenityInfos).not.toBe(source.amenities);
  });

  it("builds a camelCase update containing only changed complete fields", () => {
    const baseline = toListingEditorFormData(accommodation());
    const formData = {
      ...cloneListingEditorFormData(baseline),
      basePrice: "130000",
      addressInfo: { ...baseline.addressInfo, detail: "202호" },
      occupancyPolicyInfo: {
        ...baseline.occupancyPolicyInfo,
        petOccupancy: true,
      },
      amenityInfos: [
        { name: "TV", count: 2 },
        { name: "WIFI", count: 1 },
      ],
    };

    expect(buildListingEditorUpdate({ formData, baseline })).toEqual({
      basePrice: 130000,
      currency: "KRW",
      address: {
        postalCode: "12345",
        country: "대한민국",
        state: "Seoul",
        city: "Seoul",
        district: "Mapo",
        street: "Worldcup-ro",
        detail: "202호",
      },
      occupancyPolicy: {
        maxOccupancy: 4,
        infantOccupancy: 1,
        petOccupancy: 1,
      },
    });
  });

  it("does not expose an incomplete replacement address to the API port", () => {
    const baseline = toListingEditorFormData(accommodation());
    const formData = {
      ...baseline,
      addressInfo: { ...baseline.addressInfo, postalCode: "" },
    };

    expect(buildListingEditorUpdate({ formData, baseline })).toEqual({});
  });

  it("persists display fallbacks whose server source was null", () => {
    const source = accommodation({
      checkInTime: null,
      checkOutTime: null,
      occupancyPolicy: null,
    });
    const baseline = toListingEditorFormData(source);

    expect(
      buildListingEditorUpdate({
        baseline,
        fallbackProvenance: getListingEditorFallbackProvenance(source),
        formData: baseline,
      }),
    ).toEqual({
      checkInTime: "15:00",
      checkOutTime: "11:00",
      occupancyPolicy: {
        maxOccupancy: 1,
        infantOccupancy: 0,
        petOccupancy: 0,
      },
    });
  });

  it("keeps the existing wizard completion contract", () => {
    const form = toListingEditorFormData(accommodation());

    expect(
      isListingEditorStepCompleted(form, 5, {
        imageCount: 1,
        isNewDraft: true,
      }),
    ).toBe(true);
    expect(
      isListingEditorStepCompleted(form, 2, {
        imageCount: 0,
        isNewDraft: false,
      }),
    ).toBe(false);
  });
});
