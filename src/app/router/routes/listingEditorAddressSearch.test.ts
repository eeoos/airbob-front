import { toListingEditorAddressSelection } from "../../../features/accommodations/listing-editor/public";
import type { DaumPostcodeResult } from "../../../platform/integrations/daumPostcode";
import { openDaumPostcode } from "../../../platform/integrations/daumPostcode";
import { listingEditorAddressSearch } from "./listingEditorAddressSearch";

vi.mock("../../../features/accommodations/listing-editor/public", () => ({
  toListingEditorAddressSelection: vi.fn(),
}));
vi.mock("../../../platform/integrations/daumPostcode", () => ({
  openDaumPostcode: vi.fn(),
}));

const rawAddress: DaumPostcodeResult = {
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
  roadnameCode: "4160041",
  jibunAddress: "서울특별시 강남구 역삼동 1",
  roadAddress: "서울특별시 강남구 테헤란로 123",
};

const mappedAddress = {
  postalCode: "06236",
  country: "대한민국",
  state: "서울특별시",
  city: "서울특별시",
  district: "강남구",
  street: "테헤란로 123",
  detail: "",
};

const mockedOpenPostcode = vi.mocked(openDaumPostcode);
const mockedMapAddressSelection = vi.mocked(toListingEditorAddressSelection);

describe("listing editor address search adapter", () => {
  beforeEach(() => {
    mockedOpenPostcode.mockReset();
    mockedMapAddressSelection.mockReset();
    mockedMapAddressSelection.mockReturnValue(mappedAddress);
  });

  it("rejects an already-aborted search without opening the integration", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      listingEditorAddressSearch.search({ signal: controller.signal }),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(mockedOpenPostcode).not.toHaveBeenCalled();
  });

  it("settles and cleans up when a pending search is aborted", async () => {
    const controller = new AbortController();
    const removeEventListener = vi.spyOn(
      controller.signal,
      "removeEventListener",
    );
    mockedOpenPostcode.mockImplementation(() => new Promise(() => undefined));
    const result = listingEditorAddressSearch.search({
      signal: controller.signal,
    });

    controller.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(removeEventListener).toHaveBeenCalledWith(
      "abort",
      expect.any(Function),
    );
  });

  it("resolves once, removes the abort listener, and ignores a later abort", async () => {
    const controller = new AbortController();
    const removeEventListener = vi.spyOn(
      controller.signal,
      "removeEventListener",
    );
    let complete!: (result: DaumPostcodeResult) => void;
    mockedOpenPostcode.mockImplementation((onComplete) => {
      complete = onComplete;
      return new Promise(() => undefined);
    });
    const result = listingEditorAddressSearch.search({
      signal: controller.signal,
    });

    complete(rawAddress);

    await expect(result).resolves.toEqual(mappedAddress);
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    controller.abort();
    await Promise.resolve();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(mockedMapAddressSelection).toHaveBeenCalledTimes(1);
  });

  it("rejects once and cleans up when the integration reports an error", async () => {
    const controller = new AbortController();
    const removeEventListener = vi.spyOn(
      controller.signal,
      "removeEventListener",
    );
    let complete!: (result: DaumPostcodeResult) => void;
    let fail!: (error: Error) => void;
    mockedOpenPostcode.mockImplementation((onComplete, onError) => {
      complete = onComplete;
      fail = onError as (error: Error) => void;
      return new Promise(() => undefined);
    });
    const result = listingEditorAddressSearch.search({
      signal: controller.signal,
    });
    const integrationError = new Error("postcode unavailable");

    fail(integrationError);
    complete(rawAddress);

    await expect(result).rejects.toBe(integrationError);
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(mockedMapAddressSelection).not.toHaveBeenCalled();
  });
});
