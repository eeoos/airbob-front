import type { HostListing } from "../model/hostListing";
import { toHostListingViewModels } from "./hostListingViewModel";
import hostListContract from "../api/__fixtures__/host-accommodation-list.json";
import { toHostListingPage } from "../api/hostListingsMappers";
import type { HostListingPageWire } from "../api/hostListingsContracts";

const hostAccommodationFixture = (
  overrides: Partial<HostListing> = {},
): HostListing => ({
  addressSummary: {
    country: "대한민국",
    state: null,
    city: "부산",
    district: "해운대구",
  },
  createdAt: "2026-07-01T00:00:00Z",
  id: 7,
  name: "바다 숙소",
  status: "PUBLISHED",
  thumbnailUrl: "/stay.jpg",
  type: "ENTIRE_PLACE",
  ...overrides,
});

describe("host listing view model", () => {
  it("consumes the backend list contract with incomplete addresses and status-specific actions", () => {
    const page = toHostListingPage(hostListContract as HostListingPageWire);

    expect(page.pageInfo).toEqual({
      currentSize: 3,
      hasNext: false,
      nextCursor: null,
    });
    expect(page.listings[0]).toMatchObject({
      id: 33,
      type: null,
      createdAt: "2026-09-07T01:02:03.123456Z",
      addressSummary: {
        country: null,
        state: null,
        city: null,
        district: null,
      },
    });
    expect(toHostListingViewModels(page.listings)).toMatchObject([
      {
        id: 33,
        name: "이름 없음",
        locationLabel: "위치 정보 없음",
        statusLabel: "작성 중",
        canOpenDetail: false,
        canPublish: false,
        canUnpublish: false,
        thumbnailUrl: null,
      },
      {
        id: 32,
        name: "서울 하우스 32",
        locationLabel: "서울, 마포구",
        statusLabel: "비공개",
        canOpenDetail: false,
        canPublish: true,
        canUnpublish: false,
        thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/stay.jpg",
      },
      {
        id: 31,
        name: "서울 하우스 31",
        locationLabel: "서울, 마포구",
        statusLabel: "공개",
        canOpenDetail: true,
        canPublish: false,
        canUnpublish: true,
      },
    ]);
  });

  it("maps published host accommodations into listing and action display data", () => {
    expect(toHostListingViewModels([hostAccommodationFixture()])).toEqual([
      {
        canOpenDetail: true,
        canPublish: false,
        canUnpublish: true,
        id: 7,
        imageAlt: "바다 숙소",
        locationLabel: "부산, 해운대구",
        managementLabel: "바다 숙소 숙소 관리 열기",
        name: "바다 숙소",
        statusLabel: "공개",
        thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/stay.jpg",
      },
    ]);
  });

  it("uses fallback labels and unpublished actions for incomplete listings", () => {
    expect(
      toHostListingViewModels([
        hostAccommodationFixture({
          addressSummary: null,
          name: null,
          status: "UNPUBLISHED",
          thumbnailUrl: null,
        }),
      ]),
    ).toEqual([
      {
        canOpenDetail: false,
        canPublish: true,
        canUnpublish: false,
        id: 7,
        imageAlt: "숙소",
        locationLabel: "위치 정보 없음",
        managementLabel: "이름 없음 숙소 관리 열기",
        name: "이름 없음",
        statusLabel: "비공개",
        thumbnailUrl: null,
      },
    ]);
  });
});
