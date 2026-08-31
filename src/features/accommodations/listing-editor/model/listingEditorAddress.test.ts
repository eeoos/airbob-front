import {
  toListingEditorAddressSelection,
  type DaumPostcodeSelection,
} from "./listingEditorAddress";

const selection = (
  overrides: Partial<DaumPostcodeSelection> = {},
): DaumPostcodeSelection => ({
  zonecode: "06236",
  address: "서울특별시 강남구 테헤란로 123",
  addressEnglish: "123 Teheran-ro, Gangnam-gu, Seoul",
  addressType: "R",
  bname: "역삼동",
  buildingName: "테스트 빌딩",
  apartment: "N",
  sido: "서울특별시",
  sigungu: "강남구",
  sigunguCode: "11680",
  bcode: "1168010100",
  roadname: "테헤란로",
  roadnameCode: "4165919",
  jibunAddress: "서울특별시 강남구 역삼동 1",
  roadAddress: "서울특별시 강남구 테헤란로 123",
  ...overrides,
});

describe("listing editor Daum address mapping", () => {
  it("maps a metropolitan district and strips duplicated region labels", () => {
    expect(toListingEditorAddressSelection(selection())).toEqual({
      postalCode: "06236",
      country: "대한민국",
      state: "서울특별시",
      city: "서울특별시",
      district: "강남구",
      street: "테헤란로 123",
      detail: "",
    });
  });

  it("splits compound municipalities into city and district", () => {
    expect(
      toListingEditorAddressSelection(
        selection({
          sido: "경기도",
          sigungu: "수원시 팔달구",
          address: "경기도 수원시 팔달구 인계로 1",
          roadAddress: "경기도 수원시 팔달구 인계로 1",
        }),
      ),
    ).toMatchObject({
      state: "경기도",
      city: "수원시",
      district: "팔달구",
      street: "인계로 1",
    });
  });
});
