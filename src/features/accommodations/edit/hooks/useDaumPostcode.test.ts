import { act, renderHook } from "@testing-library/react";
import { useDaumPostcode } from "./useDaumPostcode";

describe("useDaumPostcode", () => {
  const onAddressSelected = jest.fn();
  const alert = jest.fn();

  beforeEach(() => {
    onAddressSelected.mockReset();
    alert.mockReset();
    delete (window as any).daum;
  });

  it("alerts when the Daum postcode script is unavailable", () => {
    const { result } = renderHook(() =>
      useDaumPostcode({ onAddressSelected, alert })
    );

    act(() => {
      result.current.openAddressSearch();
    });

    expect(alert).toHaveBeenCalledWith(
      "주소 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요."
    );
  });

  it("maps postcode completion data before passing it to form state", () => {
    const open = jest.fn();
    let oncomplete: ((data: any) => void) | undefined;

    (window as any).daum = {
      Postcode: jest.fn().mockImplementation((options) => {
        oncomplete = options.oncomplete;
        return { open };
      }),
    };

    const { result } = renderHook(() =>
      useDaumPostcode({ onAddressSelected, alert })
    );

    act(() => {
      result.current.openAddressSearch();
    });

    expect(open).toHaveBeenCalled();

    act(() => {
      oncomplete?.({
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
      });
    });

    expect(onAddressSelected).toHaveBeenCalledWith({
      postalCode: "06236",
      country: "대한민국",
      state: "서울특별시",
      city: "서울특별시",
      district: "강남구",
      street: "테헤란로 123",
      detail: "",
    });
  });
});
