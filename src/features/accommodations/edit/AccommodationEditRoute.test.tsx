import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../api";
import { HostAccommodationDetail } from "../../../types/accommodation";
import { AccommodationEditRoute } from "./AccommodationEditRoute";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();
const mockNavigateToHostProfile = jest.fn();

jest.mock("../../../api", () => ({
  accommodationApi: {
    getHostAccommodationDetail: jest.fn(),
    update: jest.fn(),
    publish: jest.fn(),
    deleteImage: jest.fn(),
    uploadImages: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
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
    id: 301,
    nickname: "Test Host",
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

const completedHostAccommodation: HostAccommodationDetail = {
  ...hostAccommodation,
  address: {
    country: "United States",
    state: "New York",
    city: "Albany",
    district: "Albany",
    street: "State Street",
    detail: "ETL listing 5651579",
    postal_code: "",
  },
};

const missingDetailCompletedHostAccommodation: HostAccommodationDetail = {
  ...completedHostAccommodation,
  address: {
    country: "United States",
    state: "New York",
    city: "Albany",
    district: "Albany",
    street: "State Street",
    detail: "",
    postal_code: "",
  },
};

const renderRoute = () =>
  render(
    <AccommodationEditRoute
      accommodationId="3"
      isNewDraft={false}
      onNavigateToHostProfile={mockNavigateToHostProfile}
    />
  );

beforeEach(() => {
  mockNavigateToHostProfile.mockReset();
  mockClearError.mockReset();
  mockHandleError.mockReset();
  jest.mocked(accommodationApi.getHostAccommodationDetail).mockReset();
  jest.mocked(accommodationApi.update).mockReset();
  jest.mocked(accommodationApi.publish).mockReset();
  jest.mocked(accommodationApi.deleteImage).mockReset();
  jest.mocked(accommodationApi.uploadImages).mockReset();
  global.URL.createObjectURL = jest.fn(() => "blob:pending-room");
  global.URL.revokeObjectURL = jest.fn();
});

const clickPublishStep = () => {
  fireEvent.click(screen.getAllByText("숙소 등록")[1]);
};

describe("AccommodationEditRoute", () => {
  it("keeps image file inputs uncontrolled when moving from address to photo step", async () => {
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(hostAccommodation);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    renderRoute();

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

  it("uploads pending photo files before moving from photo step to info step", async () => {
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(hostAccommodation);
    jest.mocked(accommodationApi.uploadImages).mockResolvedValue({
      uploaded_images: [
        {
          id: 99,
          image_url: "https://example.com/uploaded-room.jpg",
        },
      ],
    });

    renderRoute();

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 사진"));
    await screen.findByText("1개 이상의 사진을 선택하세요.");

    const fileInput = document.getElementById("imageInput") as HTMLInputElement;
    const pendingFile = new File(["room"], "room.png", { type: "image/png" });
    fireEvent.change(fileInput, {
      target: {
        files: [pendingFile],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() =>
      expect(accommodationApi.uploadImages).toHaveBeenCalledWith(
        3,
        [pendingFile],
        expect.any(Function)
      )
    );
    await screen.findByText("숙소 정보를 알려주세요");

    fireEvent.click(screen.getByText("숙소 사진"));

    await waitFor(() =>
      expect(
        screen.getByAltText("이미지 2").getAttribute("src")
      ).toBe("https://example.com/uploaded-room.jpg")
    );
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:pending-room");
  });

  it("uploads pending photo files before publishing from the final step", async () => {
    const callOrder: string[] = [];
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(completedHostAccommodation);
    jest.mocked(accommodationApi.uploadImages).mockImplementation(async () => {
      callOrder.push("upload");
      return {
        uploaded_images: [
          {
            id: 99,
            image_url: "https://example.com/uploaded-room.jpg",
          },
        ],
      };
    });
    jest.mocked(accommodationApi.publish).mockImplementation(async () => {
      callOrder.push("publish");
    });

    renderRoute();

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 사진"));

    const fileInput = document.getElementById("imageInput") as HTMLInputElement;
    const pendingFile = new File(["room"], "room.png", { type: "image/png" });
    fireEvent.change(fileInput, {
      target: {
        files: [pendingFile],
      },
    });

    clickPublishStep();
    await screen.findByRole("heading", { name: "숙소를 등록하세요" });
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => expect(accommodationApi.publish).toHaveBeenCalled());

    expect(callOrder).toEqual(["upload", "publish"]);
    expect(accommodationApi.uploadImages).toHaveBeenCalledWith(
      3,
      [pendingFile],
      expect.any(Function)
    );
    expect(mockNavigateToHostProfile).toHaveBeenCalledTimes(1);
  });

  it("does not publish when pending photo upload fails on the final step", async () => {
    const uploadError = new Error("upload failed");
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(completedHostAccommodation);
    jest.mocked(accommodationApi.uploadImages).mockRejectedValue(uploadError);

    renderRoute();

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 사진"));

    const fileInput = document.getElementById("imageInput") as HTMLInputElement;
    const pendingFile = new File(["room"], "room.png", { type: "image/png" });
    fireEvent.change(fileInput, {
      target: {
        files: [pendingFile],
      },
    });

    clickPublishStep();
    await screen.findByRole("heading", { name: "숙소를 등록하세요" });
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => expect(mockHandleError).toHaveBeenCalledWith(uploadError));

    expect(accommodationApi.publish).not.toHaveBeenCalled();
  });

  it("asks for detail address confirmation before uploading pending photos on final publish", async () => {
    const callOrder: string[] = [];
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(missingDetailCompletedHostAccommodation);
    jest.mocked(accommodationApi.uploadImages).mockImplementation(async () => {
      callOrder.push("upload");
      return {
        uploaded_images: [
          {
            id: 99,
            image_url: "https://example.com/uploaded-room.jpg",
          },
        ],
      };
    });
    jest.mocked(accommodationApi.publish).mockImplementation(async () => {
      callOrder.push("publish");
    });

    renderRoute();

    await screen.findByDisplayValue("State Street");
    fireEvent.click(screen.getByText("숙소 사진"));

    const fileInput = document.getElementById("imageInput") as HTMLInputElement;
    const pendingFile = new File(["room"], "room.png", { type: "image/png" });
    fireEvent.change(fileInput, {
      target: {
        files: [pendingFile],
      },
    });

    clickPublishStep();
    await screen.findByRole("heading", { name: "숙소를 등록하세요" });
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    expect(
      await screen.findByRole("dialog", { name: "상세 주소 확인" })
    ).toBeInTheDocument();
    expect(accommodationApi.uploadImages).not.toHaveBeenCalled();
    expect(accommodationApi.publish).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "진행하기" }));

    await waitFor(() => expect(accommodationApi.publish).toHaveBeenCalled());

    expect(callOrder).toEqual(["upload", "publish"]);
  });
});
