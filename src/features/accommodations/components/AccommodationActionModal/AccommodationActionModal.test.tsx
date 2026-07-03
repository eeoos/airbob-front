import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routeTo } from "../../../../routes/paths";
import { MyAccommodationInfo } from "../../../../types/accommodation";
import { AccommodationStatus } from "../../../../types/enums";
import { AccommodationActionModal } from "./AccommodationActionModal";

const mockNavigate = jest.fn();
const mockClearError = jest.fn();
const mockDeleteAccommodation = jest.fn();
const mockPublishAccommodation = jest.fn();
const mockUnpublishAccommodation = jest.fn();
let mockActionState = {
  error: null as string | null,
  isProcessing: false,
};

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../../hooks/useAccommodationActions", () => ({
  useAccommodationActions: () => ({
    clearError: mockClearError,
    deleteAccommodation: mockDeleteAccommodation,
    error: mockActionState.error,
    isProcessing: mockActionState.isProcessing,
    publishAccommodation: mockPublishAccommodation,
    unpublishAccommodation: mockUnpublishAccommodation,
  }),
}));

jest.mock("../../../../components/ErrorToast", () => ({
  ErrorToast: ({ message, onClose }: { message: string; onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      {message}
    </button>
  ),
}));

jest.mock("../../../../utils/image", () => ({
  getImageUrl: (url: string) => url,
}));

const accommodation: MyAccommodationInfo = {
  address_summary: null,
  created_at: "2026-07-03T10:00:00Z",
  id: 7,
  name: "남산 숙소",
  status: AccommodationStatus.PUBLISHED,
  thumbnail_url: "/stay.jpg",
  type: "APARTMENT",
};

const renderActionModal = (
  overrides: Partial<React.ComponentProps<typeof AccommodationActionModal>> = {},
) => {
  const props: React.ComponentProps<typeof AccommodationActionModal> = {
    accommodation,
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    ...overrides,
  };

  const view = render(<AccommodationActionModal {...props} />);

  return { props, ...view };
};

describe("AccommodationActionModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActionState = {
      error: null,
      isProcessing: false,
    };
  });

  it("renders as a Dialog and closes from explicit close, Escape, and backdrop", async () => {
    const { props } = renderActionModal();

    expect(screen.getByRole("dialog", { name: "숙소 관리" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "숙소 관리 닫기" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("presentation"));

    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it("keeps existing navigation flows", async () => {
    const { props } = renderActionModal();

    await userEvent.click(screen.getByRole("button", { name: "남산 숙소 상세 보기" }));

    expect(mockNavigate).toHaveBeenCalledWith(routeTo.accommodationDetail(7));
    expect(props.onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "리스팅 수정" }));

    expect(mockNavigate).toHaveBeenCalledWith(routeTo.accommodationEdit(7));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps publish, unpublish, and delete actions wired", async () => {
    const { rerender } = renderActionModal();

    await userEvent.click(screen.getByRole("button", { name: "리스팅 비공개" }));
    await userEvent.click(screen.getByRole("button", { name: "리스팅 삭제" }));

    expect(mockUnpublishAccommodation).toHaveBeenCalledWith(7);
    expect(mockDeleteAccommodation).toHaveBeenCalledWith(7);

    rerender(
      <AccommodationActionModal
        accommodation={{
          ...accommodation,
          status: AccommodationStatus.UNPUBLISHED,
        }}
        isOpen
        onClose={jest.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "리스팅 공개" }));

    expect(mockPublishAccommodation).toHaveBeenCalledWith(7);
  });

  it("shows hook errors through the existing toast boundary", async () => {
    mockActionState = {
      error: "처리에 실패했습니다.",
      isProcessing: false,
    };

    renderActionModal();

    await userEvent.click(screen.getByRole("button", { name: "처리에 실패했습니다." }));

    expect(mockClearError).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while closed or missing accommodation data", () => {
    const { container, rerender } = renderActionModal({ isOpen: false });

    expect(container).toBeEmptyDOMElement();

    rerender(
      <AccommodationActionModal
        accommodation={null}
        isOpen
        onClose={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
