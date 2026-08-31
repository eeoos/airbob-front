import type {
  DaumPostcodeResult,
  openDaumPostcode,
} from "../../../platform/integrations/daumPostcode";
import { createListingEditorAddressSearch } from "./listingEditorAddressSearch";

type OpenPostcode = typeof openDaumPostcode;

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

const createOpenPostcode = () => vi.fn<OpenPostcode>();

describe("listing editor address search adapter", () => {
  it("rejects an already-aborted search without opening the integration", async () => {
    const controller = new AbortController();
    controller.abort();
    const openPostcode = createOpenPostcode();
    const search = createListingEditorAddressSearch({ openPostcode });

    await expect(search.search({ signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(openPostcode).not.toHaveBeenCalled();
  });

  it("settles and cleans up when a pending search is aborted", async () => {
    const controller = new AbortController();
    const removeEventListener = vi.spyOn(
      controller.signal,
      "removeEventListener",
    );
    const openPostcode = createOpenPostcode().mockImplementation(
      () => new Promise(() => undefined),
    );
    const search = createListingEditorAddressSearch({ openPostcode });
    const result = search.search({ signal: controller.signal });

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
    const openPostcode = createOpenPostcode().mockImplementation(
      (onComplete) => {
        complete = onComplete;
        return new Promise(() => undefined);
      },
    );
    const mapAddressSelection = vi.fn(() => mappedAddress);
    const search = createListingEditorAddressSearch({
      mapAddressSelection,
      openPostcode,
    });
    const result = search.search({ signal: controller.signal });

    complete(rawAddress);

    await expect(result).resolves.toEqual(mappedAddress);
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    controller.abort();
    await Promise.resolve();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(mapAddressSelection).toHaveBeenCalledTimes(1);
  });

  it("rejects once and cleans up when the integration reports an error", async () => {
    const controller = new AbortController();
    const removeEventListener = vi.spyOn(
      controller.signal,
      "removeEventListener",
    );
    let complete!: (result: DaumPostcodeResult) => void;
    let fail!: (error: Error) => void;
    const openPostcode = createOpenPostcode().mockImplementation(
      (onComplete, onError) => {
        complete = onComplete;
        fail = onError as (error: Error) => void;
        return new Promise(() => undefined);
      },
    );
    const mapAddressSelection = vi.fn(() => mappedAddress);
    const search = createListingEditorAddressSearch({
      mapAddressSelection,
      openPostcode,
    });
    const result = search.search({ signal: controller.signal });
    const integrationError = new Error("postcode unavailable");

    fail(integrationError);
    complete(rawAddress);

    await expect(result).rejects.toBe(integrationError);
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(mapAddressSelection).not.toHaveBeenCalled();
  });
});
