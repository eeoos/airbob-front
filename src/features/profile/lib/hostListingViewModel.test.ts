import type { HostAccommodationInfo } from "../../../types/accommodation";
import { AccommodationStatus } from "../../../types/enums";
import { toHostListingViewModel } from "./hostListingViewModel";

const hostAccommodationFixture = (
  overrides: Partial<HostAccommodationInfo> = {},
): HostAccommodationInfo => ({
  address_summary: {
    country: "대한민국",
    state: null,
    city: "부산",
    district: "해운대구",
  },
  created_at: "2026-07-01T00:00:00Z",
  id: 7,
  name: "바다 숙소",
  status: AccommodationStatus.PUBLISHED,
  thumbnail_url: "/stay.jpg",
  type: "ENTIRE_PLACE",
  ...overrides,
});

describe("host listing view model", () => {
  it("maps published host accommodations into listing and action display data", () => {
    expect(toHostListingViewModel(hostAccommodationFixture())).toEqual({
      canOpenDetail: true,
      canPublish: false,
      canUnpublish: true,
      id: 7,
      imageAlt: "바다 숙소",
      locationLabel: "부산, 해운대구",
      managementLabel: "바다 숙소 숙소 관리 열기",
      name: "바다 숙소",
      statusLabel: "공개",
      thumbnailUrl: "/stay.jpg",
    });
  });

  it("uses fallback labels and unpublished actions for incomplete listings", () => {
    expect(
      toHostListingViewModel(
        hostAccommodationFixture({
          address_summary: null,
          name: null,
          status: AccommodationStatus.UNPUBLISHED,
          thumbnail_url: null,
        }),
      ),
    ).toEqual({
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
    });
  });
});
