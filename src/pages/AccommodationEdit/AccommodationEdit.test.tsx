import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { accommodationApi } from "../../api";
import { HostAccommodationDetail } from "../../types/accommodation";
import AccommodationEdit from "./AccommodationEdit";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();
const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useParams: () => ({ id: "3" }),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
  }),
  { virtual: true }
);

jest.mock("../../api", () => ({
  accommodationApi: {
    getHostAccommodationDetail: jest.fn(),
    update: jest.fn(),
    publish: jest.fn(),
    deleteImage: jest.fn(),
    uploadImages: jest.fn(),
  },
}));

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
}));

jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

jest.mock("../../components/ErrorToast", () => ({
  ErrorToast: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

jest.mock("../../layouts", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

const hostAccommodation: HostAccommodationDetail = {
  id: 3,
  name: "Large studio apt by Capital Center & ESP@",
  description: "Spacious studio",
  type: "ENTIRE_PLACE",
  base_price: 93498,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  address: {
    country: "United States",
    state: "New York",
    city: "Albany",
    district: "Albany",
    street: "",
    detail: "ETL listing 5651579",
    postal_code: "",
  },
  coordinate: {
    latitude: 42.64615,
    longitude: -73.75966,
  },
  host: {
    id: 2573,
    nickname: "Airbob QA",
    thumbnail_image_url: "",
  },
  policy: {
    max_occupancy: 2,
    infant_occupancy: 0,
    pet_occupancy: 0,
  },
  amenities: [],
  images: [
    {
      id: 3,
      image_url: "https://example.com/room.jpg",
    },
  ],
  review_summary: {
    total_count: 5,
    average_rating: 5,
  },
};

beforeEach(() => {
  mockNavigate.mockReset();
  mockClearError.mockReset();
  mockHandleError.mockReset();
  jest.mocked(accommodationApi.getHostAccommodationDetail).mockReset();
  jest.mocked(accommodationApi.update).mockReset();
  jest.mocked(accommodationApi.publish).mockReset();
  jest.mocked(accommodationApi.deleteImage).mockReset();
  jest.mocked(accommodationApi.uploadImages).mockReset();
});

describe("AccommodationEdit", () => {
  it("keeps image file inputs uncontrolled when moving from address to photo step", async () => {
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(hostAccommodation);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<AccommodationEdit />);

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 사진"));
    await screen.findByText("1개 이상의 사진을 선택하세요.");

    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "A component is changing a controlled input to be uncontrolled"
      )
    );

    consoleError.mockRestore();
  });
});
