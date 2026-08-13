import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../api";
import { HostAccommodationDetail } from "../../../types/accommodation";
import { profileQueryKeys } from "../../profile/queryKeys";
import { accommodationQueryKeys } from "../queryKeys";
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

const renderRoute = (accommodationId = "3") => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const renderRouteForId = (nextAccommodationId: string) => (
    <QueryClientProvider client={queryClient}>
      <AccommodationEditRoute
        accommodationId={nextAccommodationId}
        isNewDraft={false}
        onNavigateToHostProfile={mockNavigateToHostProfile}
      />
    </QueryClientProvider>
  );
  const view = render(renderRouteForId(accommodationId));

  return {
    ...view,
    queryClient,
    rerenderRoute: (nextAccommodationId: string) =>
      view.rerender(renderRouteForId(nextAccommodationId)),
  };
};

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
  it("does not expose the editable wizard before host detail is hydrated", async () => {
    let resolveDetail: (detail: HostAccommodationDetail) => void = () => undefined;
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDetail = resolve;
          })
      );

    renderRoute();

    expect(await screen.findByRole("status")).toHaveTextContent(
      "숙소 정보를 불러오는 중..."
    );
    expect(screen.queryByRole("button", { name: "저장 후 나가기" })).toBeNull();

    await act(async () => {
      resolveDetail(hostAccommodation);
    });

    expect(await screen.findByDisplayValue("ETL listing 5651579")).toBeVisible();
  });

  it("keeps the wizard hidden after detail loading fails and hydrates it only after retry succeeds", async () => {
    const detailError = new Error("detail failed");
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockRejectedValueOnce(detailError)
      .mockResolvedValueOnce(hostAccommodation);

    renderRoute();

    expect(
      await screen.findByRole("heading", {
        name: "숙소 정보를 불러오지 못했어요",
      })
    ).toBeVisible();
    expect(mockHandleError).toHaveBeenCalledWith(detailError);
    expect(
      screen.queryByRole("button", { name: "저장 후 나가기" })
    ).toBeNull();
    expect(screen.queryByText("숙소 위치를 알려주세요")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByDisplayValue("ETL listing 5651579")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "저장 후 나가기" })
    ).toBeVisible();
    expect(accommodationApi.getHostAccommodationDetail).toHaveBeenNthCalledWith(
      1,
      3
    );
    expect(accommodationApi.getHostAccommodationDetail).toHaveBeenNthCalledWith(
      2,
      3
    );
  });

  it("exposes only the latest accommodation when route detail responses settle in reverse order", async () => {
    const detailResolvers = new Map<
      number,
      (detail: HostAccommodationDetail) => void
    >();
    const accommodation4: HostAccommodationDetail = {
      ...hostAccommodation,
      id: 4,
      name: "Fourth accommodation",
      address: {
        country: "United States",
        state: "New York",
        city: "Albany",
        district: "Albany",
        street: "State Street",
        postal_code: "",
        detail: "Only accommodation 4",
      },
      images: [
        {
          id: 4,
          image_url: "https://example.com/room-4.jpg",
        },
      ],
    };
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockImplementation(
        (id) =>
          new Promise((resolve) => {
            detailResolvers.set(id, resolve);
          })
      );

    const { rerenderRoute } = renderRoute("3");
    await waitFor(() => expect(detailResolvers.has(3)).toBe(true));

    rerenderRoute("4");
    await waitFor(() => expect(detailResolvers.has(4)).toBe(true));

    await act(async () => {
      detailResolvers.get(4)?.(accommodation4);
    });
    expect(await screen.findByDisplayValue("Only accommodation 4")).toBeVisible();

    await act(async () => {
      detailResolvers.get(3)?.(hostAccommodation);
    });

    expect(screen.getByDisplayValue("Only accommodation 4")).toBeVisible();
    expect(screen.queryByDisplayValue("ETL listing 5651579")).toBeNull();
    fireEvent.click(screen.getByText("숙소 사진"));
    expect(screen.getByAltText("커버 사진")).toHaveAttribute(
      "src",
      "https://example.com/room-4.jpg"
    );
  });

  it("does not advance the new route when an old photo-step deletion finishes", async () => {
    let resolveDelete: () => void = () => undefined;
    const accommodation4: HostAccommodationDetail = {
      ...hostAccommodation,
      id: 4,
      address: {
        country: "United States",
        state: "New York",
        city: "Albany",
        district: "Albany",
        street: "State Street",
        postal_code: "",
        detail: "Accommodation 4 location",
      },
      images: [
        {
          id: 4,
          image_url: "https://example.com/room-4.jpg",
        },
      ],
    };
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockImplementation(async (id) =>
        id === 3 ? hostAccommodation : accommodation4
      );
    jest.mocked(accommodationApi.deleteImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = () => resolve(undefined);
        })
    );

    const { rerenderRoute } = renderRoute("3");

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 사진"));
    expect(
      await screen.findByRole("heading", { name: "숙소 사진을 등록하세요" })
    ).toBeVisible();

    const deleteButton = screen.getByRole("button", { name: "이미지 삭제" });
    const nextButton = screen.getByRole("button", { name: "다음" });
    await act(async () => {
      deleteButton.click();
      nextButton.click();
    });
    await waitFor(() =>
      expect(accommodationApi.deleteImage).toHaveBeenCalledWith(3, 3)
    );

    rerenderRoute("4");
    expect(
      await screen.findByDisplayValue("Accommodation 4 location")
    ).toBeVisible();

    await act(async () => {
      resolveDelete();
    });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "숙소 위치를 알려주세요" })
      ).toBeVisible()
    );
    expect(
      screen.queryByRole("heading", { name: "숙소 사진을 등록하세요" })
    ).toBeNull();
  });

  it("publishes a value restored after step-save against the committed baseline", async () => {
    const changedName = "Changed after hydration";
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(completedHostAccommodation);
    jest.mocked(accommodationApi.update).mockResolvedValue(undefined);
    jest.mocked(accommodationApi.publish).mockResolvedValue(undefined);

    renderRoute();

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 정보"));
    fireEvent.change(screen.getByDisplayValue(hostAccommodation.name ?? ""), {
      target: { value: changedName },
    });

    fireEvent.click(screen.getByText("체크인/체크아웃"));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() =>
      expect(accommodationApi.update).toHaveBeenNthCalledWith(1, 3, {
        name: changedName,
      })
    );
    expect(
      await screen.findByRole("heading", { name: "숙소를 등록하세요" })
    ).toBeVisible();

    fireEvent.click(screen.getByText("숙소 정보"));
    fireEvent.change(screen.getByDisplayValue(changedName), {
      target: { value: hostAccommodation.name ?? "" },
    });
    fireEvent.click(screen.getAllByText("숙소 등록")[1]);
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => expect(accommodationApi.publish).toHaveBeenCalledWith(3));
    expect(accommodationApi.update).toHaveBeenNthCalledWith(2, 3, {
      name: hostAccommodation.name,
    });
  });

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

    const fileInput = screen.getByLabelText("숙소 사진 추가 선택");
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

  it("runs only one photo-step transition when next is triggered twice", async () => {
    let resolveUpload: (value: {
      uploaded_images: Array<{ id: number; image_url: string }>;
    }) => void = () => undefined;
    const uploadPromise = new Promise<{
      uploaded_images: Array<{ id: number; image_url: string }>;
    }>((resolve) => {
      resolveUpload = resolve;
    });
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(hostAccommodation);
    jest
      .mocked(accommodationApi.uploadImages)
      .mockImplementation(() => uploadPromise);

    renderRoute();

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 사진"));
    fireEvent.change(screen.getByLabelText("숙소 사진 추가 선택"), {
      target: {
        files: [new File(["room"], "room.png", { type: "image/png" })],
      },
    });

    const nextButton = screen.getByRole("button", { name: "다음" });
    act(() => {
      nextButton.click();
      nextButton.click();
    });

    await waitFor(() =>
      expect(accommodationApi.uploadImages).toHaveBeenCalledTimes(1)
    );

    await act(async () => {
      resolveUpload({
        uploaded_images: [
          { id: 99, image_url: "https://example.com/uploaded-room.jpg" },
        ],
      });
      await uploadPromise;
    });

    expect(
      await screen.findByRole("heading", { name: "숙소 정보를 알려주세요" })
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", {
        name: "체크인/체크아웃 시간을 설정하세요",
      })
    ).toBeNull();
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

    const fileInput = screen.getByLabelText("숙소 사진 추가 선택");
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

  it("uploads pending photo files before saving and exiting", async () => {
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
    mockNavigateToHostProfile.mockImplementation(() => {
      callOrder.push("navigate");
    });

    const { queryClient } = renderRoute();
    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 사진"));

    const fileInput = screen.getByLabelText("숙소 사진 추가 선택");
    const pendingFile = new File(["room"], "room.png", { type: "image/png" });
    fireEvent.change(fileInput, {
      target: {
        files: [pendingFile],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "저장 후 나가기" }));

    await waitFor(() => expect(mockNavigateToHostProfile).toHaveBeenCalled());

    expect(accommodationApi.uploadImages).toHaveBeenCalledWith(
      3,
      [pendingFile],
      expect.any(Function)
    );
    expect(callOrder).toEqual(["upload", "navigate"]);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: accommodationQueryKeys.detailRoot,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: profileQueryKeys.hostListingsRoot,
    });
  });

  it("locks wizard mutations while save-and-exit preparation is pending", async () => {
    let resolveUpload: (value: {
      uploaded_images: Array<{ id: number; image_url: string }>;
    }) => void = () => undefined;
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(completedHostAccommodation);
    jest.mocked(accommodationApi.uploadImages).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    renderRoute();

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 사진"));

    const fileInput = screen.getByLabelText("숙소 사진 추가 선택");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["room"], "room.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장 후 나가기" }));

    await waitFor(() => expect(accommodationApi.uploadImages).toHaveBeenCalled());
    expect(fileInput).toBeDisabled();
    expect(screen.getByRole("button", { name: /위치/ })).toBeDisabled();
    expect(mockNavigateToHostProfile).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpload({
        uploaded_images: [
          { id: 99, image_url: "https://example.com/uploaded-room.jpg" },
        ],
      });
    });

    await waitFor(() => expect(mockNavigateToHostProfile).toHaveBeenCalled());
  });

  it("stays in the editor when save-and-exit photo upload fails", async () => {
    const uploadError = new Error("upload failed");
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(completedHostAccommodation);
    jest.mocked(accommodationApi.uploadImages).mockRejectedValue(uploadError);

    renderRoute();

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 사진"));

    const fileInput = screen.getByLabelText("숙소 사진 추가 선택");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["room"], "room.png", { type: "image/png" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "저장 후 나가기" }));

    await waitFor(() => expect(mockHandleError).toHaveBeenCalledWith(uploadError));
    expect(mockNavigateToHostProfile).not.toHaveBeenCalled();
  });

  it("waits for a pending image deletion and aborts navigation when it fails", async () => {
    const deleteError = new Error("delete failed");
    let rejectDelete: (error: Error) => void = () => undefined;
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(completedHostAccommodation);
    jest.mocked(accommodationApi.deleteImage).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectDelete = reject;
        })
    );

    renderRoute();

    await screen.findByDisplayValue("ETL listing 5651579");
    fireEvent.click(screen.getByText("숙소 사진"));
    fireEvent.click(screen.getByRole("button", { name: "이미지 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "저장 후 나가기" }));

    expect(mockNavigateToHostProfile).not.toHaveBeenCalled();

    await act(async () => {
      rejectDelete(deleteError);
    });

    await waitFor(() => expect(mockHandleError).toHaveBeenCalledWith(deleteError));
    expect(mockNavigateToHostProfile).not.toHaveBeenCalled();
    expect(screen.getByAltText("커버 사진")).toBeVisible();
  });

  it("confirms a missing detail address before save-and-exit uploads photos", async () => {
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(missingDetailCompletedHostAccommodation);
    jest.mocked(accommodationApi.uploadImages).mockResolvedValue({
      uploaded_images: [
        {
          id: 99,
          image_url: "https://example.com/uploaded-room.jpg",
        },
      ],
    });

    renderRoute();

    await screen.findByDisplayValue("State Street");
    fireEvent.click(screen.getByText("숙소 사진"));

    const fileInput = screen.getByLabelText("숙소 사진 추가 선택");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["room"], "room.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByText("위치"));

    fireEvent.click(screen.getByRole("button", { name: "저장 후 나가기" }));

    expect(
      await screen.findByRole("dialog", { name: "상세 주소 확인" })
    ).toBeInTheDocument();
    expect(accommodationApi.uploadImages).not.toHaveBeenCalled();
    expect(mockNavigateToHostProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "진행하기" }));

    await waitFor(() => expect(mockNavigateToHostProfile).toHaveBeenCalled());
    expect(accommodationApi.uploadImages).toHaveBeenCalledTimes(1);
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

    const fileInput = screen.getByLabelText("숙소 사진 추가 선택");
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

    const fileInput = screen.getByLabelText("숙소 사진 추가 선택");
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
