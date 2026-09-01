const accommodationAmenityDefinitions = [
  { code: "WIFI", label: "무선 인터넷" },
  { code: "AIR_CONDITIONER", label: "에어컨" },
  { code: "HEATING", label: "난방" },
  { code: "KITCHEN", label: "주방" },
  { code: "WASHER", label: "세탁기" },
  { code: "DRYER", label: "건조기" },
  { code: "PARKING", label: "주차 공간" },
  { code: "TV", label: "TV" },
  { code: "HAIR_DRYER", label: "헤어드라이어" },
  { code: "IRON", label: "다리미" },
  { code: "SHAMPOO", label: "샴푸" },
  { code: "BED_LINENS", label: "침구류" },
  { code: "EXTRA_PILLOWS", label: "추가 베개 및 담요" },
  { code: "CRIB", label: "아기 침대" },
  { code: "HIGH_CHAIR", label: "아기 식탁의자" },
  { code: "DISHWASHER", label: "식기세척기" },
  { code: "COFFEE_MACHINE", label: "커피 머신" },
  { code: "MICROWAVE", label: "전자레인지" },
  { code: "REFRIGERATOR", label: "냉장고" },
  { code: "ELEVATOR", label: "엘리베이터" },
  { code: "POOL", label: "수영장" },
  { code: "HOT_TUB", label: "온수 욕조" },
  { code: "GYM", label: "헬스장" },
  { code: "SMOKE_ALARM", label: "화재 경보기" },
  { code: "CARBON_MONOXIDE_ALARM", label: "일산화탄소 경보기" },
  { code: "FIRE_EXTINGUISHER", label: "소화기" },
  { code: "PETS_ALLOWED", label: "반려동물 허용" },
  { code: "OUTDOOR_SPACE", label: "야외 공간" },
  { code: "BBQ_GRILL", label: "바베큐 그릴" },
  { code: "BALCONY", label: "발코니" },
] as const;

export type AccommodationAmenityCode =
  (typeof accommodationAmenityDefinitions)[number]["code"];

type KnownAccommodationAmenity =
  (typeof accommodationAmenityDefinitions)[number] & {
    readonly isKnown: true;
  };

interface ResolvedAccommodationAmenity {
  readonly code: string;
  readonly isKnown: boolean;
  readonly label: string;
}

export interface AccommodationAmenityCatalog {
  readonly knownAmenities: readonly KnownAccommodationAmenity[];
  resolve(code: string): ResolvedAccommodationAmenity;
}

const UNKNOWN_ACCOMMODATION_AMENITY_LABEL = "알 수 없는 편의시설";

const knownAmenities: readonly KnownAccommodationAmenity[] =
  accommodationAmenityDefinitions.map((definition) => ({
    ...definition,
    isKnown: true,
  }));

const knownAmenitiesByCode = new Map(
  knownAmenities.map((amenity) => [amenity.code, amenity] as const),
);

export const accommodationAmenityCatalog: AccommodationAmenityCatalog = {
  knownAmenities,
  resolve(code) {
    return (
      knownAmenitiesByCode.get(code as AccommodationAmenityCode) ?? {
        code,
        isKnown: false,
        label: UNKNOWN_ACCOMMODATION_AMENITY_LABEL,
      }
    );
  },
};
