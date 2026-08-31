export interface DaumPostcodeSelection {
  readonly zonecode: string;
  readonly address: string;
  readonly addressEnglish: string;
  readonly addressType: string;
  readonly bname: string;
  readonly buildingName: string;
  readonly apartment: string;
  readonly sido: string;
  readonly sigungu: string;
  readonly sigunguCode: string;
  readonly bcode: string;
  readonly roadname: string;
  readonly roadnameCode: string;
  readonly jibunAddress: string;
  readonly roadAddress?: string;
}

export interface ListingEditorAddressSelection {
  readonly postalCode: string;
  readonly city: string;
  readonly state: string;
  readonly country: string;
  readonly detail: string;
  readonly district: string;
  readonly street: string;
}

const METROPOLITAN_PREFIXES = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
];

export const toListingEditorAddressSelection = (
  data: DaumPostcodeSelection,
): ListingEditorAddressSelection => {
  const state = data.sido || "";
  const municipality = data.sigungu || "";
  let city = "";
  let district = "";

  if (municipality.includes(" ")) {
    const parts = municipality.split(" ").filter(Boolean);
    city = parts.at(0) ?? "";
    district = parts.slice(1).join(" ");
  } else if (
    municipality &&
    METROPOLITAN_PREFIXES.some((prefix) => state.startsWith(prefix))
  ) {
    city = state;
    district = municipality;
  } else if (municipality) {
    city = municipality;
  } else {
    city = state;
  }

  const street = (data.roadAddress || data.address || "")
    .replace(state, "")
    .replace(municipality, "")
    .trim();

  return {
    postalCode: data.zonecode || "",
    country: "대한민국",
    state,
    city,
    district,
    street,
    detail: "",
  };
};
