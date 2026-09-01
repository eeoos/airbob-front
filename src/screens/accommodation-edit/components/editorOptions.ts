export interface EditorSelectOption {
  value: string;
  label: string;
}

export const ACCOMMODATION_TYPE_OPTIONS: readonly EditorSelectOption[] = [
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
