export interface DaumPostcodeData {
  zonecode: string;
  address: string;
  addressEnglish: string;
  addressType: string;
  bname: string;
  buildingName: string;
  apartment: string;
  sido: string;
  sigungu: string;
  sigunguCode: string;
  bcode: string;
  roadname: string;
  roadnameCode: string;
  jibunAddress: string;
  roadAddress?: string;
}

export interface AccommodationEditAddressInfo {
  postalCode: string;
  city: string;
  state: string;
  country: string;
  detail: string;
  district: string;
  street: string;
}

const METROPOLITAN_PREFIXES = ["서울", "부산", "대구", "인천", "광주", "대전", "울산"];

export const mapDaumPostcodeToAddressInfo = (
  data: DaumPostcodeData
): AccommodationEditAddressInfo => {
  const fullSido = data.sido || "";
  const fullSigungu = data.sigungu || "";

  let city = "";
  let district = "";

  if (fullSigungu.includes(" ")) {
    const parts = fullSigungu.split(" ").filter(Boolean);
    city = parts[0];
    district = parts.slice(1).join(" ");
  } else if (
    fullSigungu !== "" &&
    METROPOLITAN_PREFIXES.some((metro) => fullSido.startsWith(metro))
  ) {
    city = fullSido;
    district = fullSigungu;
  } else if (fullSigungu !== "") {
    city = fullSigungu;
    district = "";
  } else {
    city = fullSido;
    district = "";
  }

  let street = data.roadAddress || data.address || "";
  street = street.replace(fullSido, "").replace(fullSigungu, "").trim();

  return {
    postalCode: data.zonecode || "",
    country: "대한민국",
    state: fullSido,
    city,
    district,
    street,
    detail: "",
  };
};
