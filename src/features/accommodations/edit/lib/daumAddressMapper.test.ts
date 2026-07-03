import { mapDaumPostcodeToAddressInfo } from "./daumAddressMapper";

describe("daum address mapper", () => {
  it("maps metropolitan addresses with sigungu as district", () => {
    expect(
      mapDaumPostcodeToAddressInfo({
        zonecode: "06236",
        address: "서울특별시 강남구 테헤란로 123",
        addressEnglish: "",
        addressType: "R",
        bname: "",
        buildingName: "",
        apartment: "",
        sido: "서울특별시",
        sigungu: "강남구",
        sigunguCode: "",
        bcode: "",
        roadname: "테헤란로",
        roadnameCode: "",
        jibunAddress: "",
        roadAddress: "서울특별시 강남구 테헤란로 123",
      })
    ).toEqual({
      postalCode: "06236",
      country: "대한민국",
      state: "서울특별시",
      city: "서울특별시",
      district: "강남구",
      street: "테헤란로 123",
      detail: "",
    });
  });

  it("splits city and district when sigungu contains both", () => {
    expect(
      mapDaumPostcodeToAddressInfo({
        zonecode: "54896",
        address: "전북특별자치도 전주시 덕진구 백제대로 567",
        addressEnglish: "",
        addressType: "R",
        bname: "",
        buildingName: "",
        apartment: "",
        sido: "전북특별자치도",
        sigungu: "전주시 덕진구",
        sigunguCode: "",
        bcode: "",
        roadname: "백제대로",
        roadnameCode: "",
        jibunAddress: "",
        roadAddress: "전북특별자치도 전주시 덕진구 백제대로 567",
      })
    ).toEqual({
      postalCode: "54896",
      country: "대한민국",
      state: "전북특별자치도",
      city: "전주시",
      district: "덕진구",
      street: "백제대로 567",
      detail: "",
    });
  });

  it("falls back to sido as city when sigungu is missing", () => {
    expect(
      mapDaumPostcodeToAddressInfo({
        zonecode: "30100",
        address: "세종특별자치시 도움5로 20",
        addressEnglish: "",
        addressType: "R",
        bname: "",
        buildingName: "",
        apartment: "",
        sido: "세종특별자치시",
        sigungu: "",
        sigunguCode: "",
        bcode: "",
        roadname: "도움5로",
        roadnameCode: "",
        jibunAddress: "",
        roadAddress: "세종특별자치시 도움5로 20",
      })
    ).toMatchObject({
      state: "세종특별자치시",
      city: "세종특별자치시",
      district: "",
      street: "도움5로 20",
    });
  });
});
