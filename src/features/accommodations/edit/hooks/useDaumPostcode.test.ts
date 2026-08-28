import { act, renderHook, waitFor } from "@testing-library/react";
import { useDaumPostcode } from "./useDaumPostcode";

const daumScripts = () =>
  // Script tags have no accessible role; this integration test owns the DOM tag.
  // eslint-disable-next-line testing-library/no-node-access
  Array.from(document.scripts).filter(
    (script) =>
      script.src ===
      "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js",
  );

describe("useDaumPostcode", () => {
  const onAddressSelected = jest.fn();
  const alert = jest.fn();

  beforeEach(() => {
    onAddressSelected.mockReset();
    alert.mockReset();
    delete window.daum;
    daumScripts().forEach((script) => script.remove());
  });

  afterEach(() => {
    daumScripts().forEach((script) => script.dispatchEvent(new Event("error")));
    daumScripts().forEach((script) => script.remove());
    delete window.daum;
  });

  it("lazy-loads the SDK and preserves the unavailable Korean alert", async () => {
    const { result } = renderHook(() =>
      useDaumPostcode({ onAddressSelected, alert }),
    );

    act(() => result.current.openAddressSearch());
    expect(daumScripts()).toHaveLength(1);

    act(() => daumScripts()[0].dispatchEvent(new Event("error")));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "주소 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요.",
      ),
    );
  });

  it("maps postcode completion data before passing it to form state", async () => {
    const open = jest.fn();
    let oncomplete: ((data: any) => void) | undefined;

    window.daum = {
      Postcode: jest.fn().mockImplementation((options) => {
        oncomplete = options.oncomplete;
        return { embed: jest.fn(), open };
      }) as any,
    };

    const { result } = renderHook(() =>
      useDaumPostcode({ onAddressSelected, alert }),
    );

    act(() => result.current.openAddressSearch());
    await waitFor(() => expect(open).toHaveBeenCalled());

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

  it("does not open the provider when the hook unmounts during SDK loading", async () => {
    const open = jest.fn();
    const Postcode = jest.fn().mockReturnValue({
      embed: jest.fn(),
      open,
    });
    const { result, unmount } = renderHook(() =>
      useDaumPostcode({ onAddressSelected, alert }),
    );

    act(() => result.current.openAddressSearch());
    const script = daumScripts()[0];
    unmount();

    window.daum = { Postcode: Postcode as any };
    await act(async () => {
      script.dispatchEvent(new Event("load"));
      await Promise.resolve();
    });

    expect(Postcode).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(onAddressSelected).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it("fences an older popup callback when a newer search replaces it", async () => {
    const completions: Array<(data: any) => void> = [];
    const open = jest.fn();
    window.daum = {
      Postcode: jest.fn().mockImplementation((options) => {
        completions.push(options.oncomplete);
        return { embed: jest.fn(), open };
      }) as any,
    };
    const { result } = renderHook(() =>
      useDaumPostcode({ onAddressSelected, alert }),
    );
    const postcodeResult = (zonecode: string, roadAddress: string) => ({
      zonecode,
      address: roadAddress,
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
      roadAddress,
    });

    act(() => result.current.openAddressSearch());
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    act(() => result.current.openAddressSearch());
    await waitFor(() => expect(open).toHaveBeenCalledTimes(2));

    act(() => completions[0](postcodeResult("00001", "테헤란로 1")));
    expect(onAddressSelected).not.toHaveBeenCalled();

    act(() => completions[1](postcodeResult("00002", "테헤란로 2")));
    expect(onAddressSelected).toHaveBeenCalledTimes(1);
    expect(onAddressSelected).toHaveBeenCalledWith(
      expect.objectContaining({ postalCode: "00002", street: "테헤란로 2" }),
    );
  });
});
