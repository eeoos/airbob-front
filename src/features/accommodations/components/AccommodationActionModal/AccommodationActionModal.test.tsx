import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AccommodationActionModal,
  type AccommodationActionModalProps,
  type AccommodationActionViewModel,
} from "./AccommodationActionModal";

const accommodation: AccommodationActionViewModel = {
  canOpenDetail: true,
  canPublish: false,
  canUnpublish: true,
  id: 7,
  imageAlt: "남산 숙소",
  name: "남산 숙소",
  thumbnailUrl: "/stay.jpg",
};

const createProps = (
  overrides: Partial<AccommodationActionModalProps> = {},
): AccommodationActionModalProps => ({
  accommodation,
  errorMessage: null,
  isPending: false,
  onClose: vi.fn(),
  onDelete: vi.fn(),
  onDismissError: vi.fn(),
  onEdit: vi.fn(),
  onOpenDetail: vi.fn(),
  onPublish: vi.fn(),
  onUnpublish: vi.fn(),
  ...overrides,
});

describe("AccommodationActionModal", () => {
  it("renders as a Dialog and closes from explicit close, Escape, and backdrop", async () => {
    const onClose = vi.fn();

    render(<AccommodationActionModal {...createProps({ onClose })} />);

    expect(
      screen.getByRole("dialog", { name: "숙소 관리" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "숙소 관리 닫기" }),
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("presentation"));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("delegates detail and edit navigation before closing", async () => {
    const onClose = vi.fn();
    const onEdit = vi.fn();
    const onOpenDetail = vi.fn();

    render(
      <AccommodationActionModal
        {...createProps({ onClose, onEdit, onOpenDetail })}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "남산 숙소 상세 보기" }),
    );
    expect(onOpenDetail).toHaveBeenCalledWith(7);
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "리스팅 수정" }));
    expect(onEdit).toHaveBeenCalledWith(7);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("delegates publish, unpublish, and delete actions by accommodation id", async () => {
    const onDelete = vi.fn();
    const onPublish = vi.fn();
    const onUnpublish = vi.fn();
    const props = createProps({ onDelete, onPublish, onUnpublish });
    const { rerender } = render(<AccommodationActionModal {...props} />);

    await userEvent.click(
      screen.getByRole("button", { name: "리스팅 비공개" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "리스팅 삭제" }));

    expect(onUnpublish).toHaveBeenCalledWith(7);
    expect(onDelete).toHaveBeenCalledWith(7);

    rerender(
      <AccommodationActionModal
        {...props}
        accommodation={{
          ...accommodation,
          canOpenDetail: false,
          canPublish: true,
          canUnpublish: false,
        }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "리스팅 공개" }));

    expect(onPublish).toHaveBeenCalledWith(7);
    expect(
      screen.queryByRole("button", { name: "남산 숙소 상세 보기" }),
    ).not.toBeInTheDocument();
  });

  it("injects pending and error state without disabling dismissal or detail", async () => {
    const onDismissError = vi.fn();

    render(
      <AccommodationActionModal
        {...createProps({
          errorMessage: "처리에 실패했습니다.",
          isPending: true,
          onDismissError,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "리스팅 수정" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "리스팅 비공개" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "리스팅 삭제" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "숙소 관리 닫기" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "남산 숙소 상세 보기" }),
    ).toBeEnabled();

    expect(screen.getByRole("alert")).toHaveTextContent("처리에 실패했습니다.");
    await userEvent.click(screen.getByRole("button", { name: "오류 닫기" }));
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without a selected accommodation", () => {
    const { container } = render(
      <AccommodationActionModal {...createProps({ accommodation: null })} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
