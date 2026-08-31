import type { ApiDataRequest } from "../../../../platform/http/request";
import type { ListingEditorApiTransport } from "./listingEditorApi";
import { createListingEditorApi } from "./listingEditorApi";

const hostDetailWire = {
  id: 31,
  name: "합정 테스트 숙소",
  description: "조용한 숙소",
  type: "APARTMENT",
  base_price: 125000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  address: {
    country: "대한민국",
    state: "서울특별시",
    city: "서울",
    district: "마포구",
    street: "월드컵북로",
    detail: "101호",
    postal_code: "04000",
  },
  coordinate: {
    latitude: 37.556,
    longitude: 126.923,
  },
  host: {
    id: 202,
    nickname: "합정 호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 0,
  },
  amenities: [{ type: "WIFI", count: 1 }],
  images: [{ id: 301, image_url: "/room-301.png" }],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
};

const createTransport = () => {
  const request = vi.fn();
  const requestNullable = vi.fn();

  return {
    request,
    requestNullable,
    transport: {
      request: request as ListingEditorApiTransport["request"],
      requestNullable:
        requestNullable as ListingEditorApiTransport["requestNullable"],
    },
  };
};

describe("listing editor API adapter", () => {
  it("preserves the host-detail GET and maps only the editor-owned model", async () => {
    const { request, transport } = createTransport();
    const api = createListingEditorApi(transport);
    const signal = new AbortController().signal;
    request.mockResolvedValue(hostDetailWire);

    await expect(api.getHostDetail(31, { signal })).resolves.toEqual({
      id: 31,
      name: "합정 테스트 숙소",
      description: "조용한 숙소",
      type: "APARTMENT",
      basePrice: 125000,
      currency: "KRW",
      checkInTime: "15:00:00",
      checkOutTime: "11:00:00",
      address: {
        country: "대한민국",
        state: "서울특별시",
        city: "서울",
        district: "마포구",
        street: "월드컵북로",
        detail: "101호",
        postalCode: "04000",
      },
      occupancyPolicy: {
        maxOccupancy: 4,
        infantOccupancy: 1,
        petOccupancy: 0,
      },
      amenities: [{ name: "WIFI", count: 1 }],
      images: [{ id: 301, imageUrl: "/room-301.png" }],
    });
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/profile/host/accommodations/31",
      signal,
    });
  });

  it("preserves nullable draft baselines without exposing unrelated response fields", async () => {
    const { request, transport } = createTransport();
    const api = createListingEditorApi(transport);
    request.mockResolvedValue({
      ...hostDetailWire,
      name: null,
      description: null,
      type: null,
      base_price: null,
      currency: null,
      check_in_time: null,
      check_out_time: null,
      address: null,
      policy: null,
      amenities: [],
      images: [],
    });

    await expect(api.getHostDetail(31)).resolves.toEqual({
      id: 31,
      name: null,
      description: null,
      type: null,
      basePrice: null,
      currency: null,
      checkInTime: null,
      checkOutTime: null,
      address: null,
      occupancyPolicy: null,
      amenities: [],
      images: [],
    });
  });

  it("preserves the update PATCH and maps camelCase input to the exact wire body", async () => {
    const { requestNullable, transport } = createTransport();
    const api = createListingEditorApi(transport);
    const signal = new AbortController().signal;
    requestNullable.mockResolvedValue(null);

    await expect(
      api.update(
        31,
        {
          name: "수정된 숙소",
          description: "수정된 설명",
          basePrice: 135000,
          currency: "KRW",
          address: {
            postalCode: "04000",
            country: "대한민국",
            state: "서울특별시",
            city: "서울",
            district: "마포구",
            street: "월드컵북로",
            detail: "",
          },
          amenities: [{ name: "WIFI", count: 2 }],
          occupancyPolicy: {
            maxOccupancy: 5,
            infantOccupancy: 1,
            petOccupancy: 0,
          },
          type: "APARTMENT",
          checkInTime: "16:00",
          checkOutTime: "10:00",
        },
        { signal },
      ),
    ).resolves.toBeUndefined();

    expect(requestNullable).toHaveBeenCalledWith({
      method: "PATCH",
      path: "/accommodations/31",
      body: {
        name: "수정된 숙소",
        description: "수정된 설명",
        base_price: 135000,
        currency: "KRW",
        address_info: {
          postal_code: "04000",
          country: "대한민국",
          state: "서울특별시",
          city: "서울",
          district: "마포구",
          street: "월드컵북로",
          detail: "",
        },
        amenity_infos: [{ name: "WIFI", count: 2 }],
        occupancy_policy_info: {
          max_occupancy: 5,
          infant_occupancy: 1,
          pet_occupancy: 0,
        },
        type: "APARTMENT",
        check_in_time: "16:00",
        check_out_time: "10:00",
      },
      signal,
    });
  });

  it("omits update fields that the editor did not submit", async () => {
    const { requestNullable, transport } = createTransport();
    const api = createListingEditorApi(transport);
    requestNullable.mockResolvedValue(null);

    await api.update(31, { name: "이름만 변경" });

    expect(requestNullable).toHaveBeenCalledWith({
      method: "PATCH",
      path: "/accommodations/31",
      body: { name: "이름만 변경" },
      signal: undefined,
    });
  });

  it("uploads repeated images fields in selection order and maps progress-aware results", async () => {
    const { request, transport } = createTransport();
    const api = createListingEditorApi(transport);
    const signal = new AbortController().signal;
    const onProgress = vi.fn();
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.jpg", {
      type: "image/jpeg",
    });
    request.mockResolvedValue({
      uploaded_images: [
        { id: 401, image_url: "/first.png" },
        { id: 402, image_url: "/second.jpg" },
      ],
    });

    await expect(
      api.uploadImages(31, [first, second], { onProgress, signal }),
    ).resolves.toEqual([
      { id: 401, imageUrl: "/first.png" },
      { id: 402, imageUrl: "/second.jpg" },
    ]);

    const requestInput = request.mock.calls.at(0)?.at(0) as
      | ApiDataRequest
      | undefined;
    if (!requestInput) throw new Error("Expected an image upload request");
    expect(requestInput).toMatchObject({
      bodyEncoding: "multipart",
      method: "POST",
      onUploadProgress: onProgress,
      path: "/accommodations/31/images",
      signal,
    });
    expect(requestInput.body).toBeInstanceOf(FormData);
    expect((requestInput.body as FormData).getAll("images")).toEqual([
      first,
      second,
    ]);
    expect(Array.from((requestInput.body as FormData).keys())).toEqual([
      "images",
      "images",
    ]);
  });

  it("preserves image deletion and publication as nullable commands", async () => {
    const { requestNullable, transport } = createTransport();
    const api = createListingEditorApi(transport);
    const signal = new AbortController().signal;
    requestNullable.mockResolvedValue(null);

    await expect(
      api.deleteImage(31, 301, { signal }),
    ).resolves.toBeUndefined();
    await expect(api.publish(31, { signal })).resolves.toBeUndefined();

    expect(requestNullable).toHaveBeenNthCalledWith(1, {
      method: "DELETE",
      path: "/accommodations/31/images/301",
      signal,
    });
    expect(requestNullable).toHaveBeenNthCalledWith(2, {
      method: "PATCH",
      path: "/accommodations/31/publish",
      signal,
    });
  });
});
