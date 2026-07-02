export interface SelectOption {
  value: string;
  label: string;
}

export interface CouponDiscountInput {
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
  discount_value: number;
  min_payment_price?: number | null;
  max_discount_amount?: number | null;
}

export const DEFAULT_ACCOMMODATION_TYPE_OPTIONS: SelectOption[] = [
  { value: "ENTIRE_PLACE", label: "전체 숙소" },
  { value: "PRIVATE_ROOM", label: "개인실" },
  { value: "SHARED_ROOM", label: "다인실" },
  { value: "HOTEL_ROOM", label: "호텔 객실" },
  { value: "HOSTEL", label: "호스텔" },
  { value: "VILLA", label: "빌라" },
  { value: "GUESTHOUSE", label: "게스트하우스" },
  { value: "BNB", label: "B&B" },
  { value: "RESORT", label: "리조트" },
  { value: "APARTMENT", label: "아파트" },
  { value: "HOUSE", label: "일반 주택" },
  { value: "TENT", label: "텐트" },
  { value: "BOAT", label: "보트" },
  { value: "TREEHOUSE", label: "트리하우스" },
  { value: "CAMPER_VAN", label: "캠핑카" },
  { value: "CASTLE", label: "성 같은 특이한 숙소" },
];

export const DEFAULT_AMENITY_OPTIONS: SelectOption[] = [
  { value: "WIFI", label: "무선 인터넷" },
  { value: "AIR_CONDITIONER", label: "에어컨" },
  { value: "HEATING", label: "난방" },
  { value: "KITCHEN", label: "주방" },
  { value: "WASHER", label: "세탁기" },
  { value: "DRYER", label: "건조기" },
  { value: "PARKING", label: "주차 공간" },
  { value: "TV", label: "TV" },
  { value: "HAIR_DRYER", label: "헤어드라이어" },
  { value: "IRON", label: "다리미" },
  { value: "SHAMPOO", label: "샴푸" },
  { value: "BED_LINENS", label: "침구류" },
  { value: "EXTRA_PILLOWS", label: "추가 베개 및 담요" },
  { value: "CRIB", label: "아기 침대" },
  { value: "HIGH_CHAIR", label: "아기 식탁의자" },
  { value: "DISHWASHER", label: "식기세척기" },
  { value: "COFFEE_MACHINE", label: "커피 머신" },
  { value: "MICROWAVE", label: "전자레인지" },
  { value: "REFRIGERATOR", label: "냉장고" },
  { value: "ELEVATOR", label: "엘리베이터" },
  { value: "POOL", label: "수영장" },
  { value: "HOT_TUB", label: "온수 욕조" },
  { value: "GYM", label: "헬스장" },
  { value: "SMOKE_ALARM", label: "화재 경보기" },
  { value: "CARBON_MONOXIDE_ALARM", label: "일산화탄소 경보기" },
  { value: "FIRE_EXTINGUISHER", label: "소화기" },
  { value: "PETS_ALLOWED", label: "반려동물 허용" },
  { value: "OUTDOOR_SPACE", label: "야외 공간" },
  { value: "BBQ_GRILL", label: "바베큐 그릴" },
  { value: "BALCONY", label: "발코니" },
];

const accommodationTypeLabels = new Map(
  DEFAULT_ACCOMMODATION_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

const amenityLabels = new Map(
  DEFAULT_AMENITY_OPTIONS.map((option) => [option.value, option.label])
);

export const getAccommodationTypeLabel = (code: string | null | undefined): string => {
  if (!code) return "숙소";
  return accommodationTypeLabels.get(code) || code;
};

export const getAmenityLabel = (code: string | null | undefined): string => {
  if (!code) return "";
  return amenityLabels.get(code) || code;
};

export const formatCouponDiscount = (coupon: CouponDiscountInput): string => {
  if (coupon.discount_type === "PERCENTAGE") {
    return `${coupon.discount_value}% 할인`;
  }
  return `${coupon.discount_value.toLocaleString()}원 할인`;
};

export const calculateCouponDiscount = (
  coupon: CouponDiscountInput,
  amount: number
): number => {
  if (coupon.min_payment_price != null && amount < coupon.min_payment_price) {
    return 0;
  }

  const discount =
    coupon.discount_type === "PERCENTAGE"
      ? Math.floor((amount * coupon.discount_value) / 100)
      : coupon.discount_value;

  const cappedDiscount =
    coupon.discount_type === "PERCENTAGE" && coupon.max_discount_amount != null
      ? Math.min(discount, coupon.max_discount_amount)
      : discount;

  return Math.min(cappedDiscount, amount);
};
