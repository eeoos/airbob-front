import { fireEvent, render, screen } from "@testing-library/react";
import type { AccommodationDetailImageViewModel } from "../lib/accommodationDetailViewModel";
import { AccommodationImageGalleryModal } from "./AccommodationImageGalleryModal";

const images: AccommodationDetailImageViewModel[] = [
  { id: 1, url: "/one.jpg", alt: "남산 전망 숙소 1" },
  { id: 2, url: "/two.jpg", alt: "남산 전망 숙소 2" },
  { id: 3, url: "/three.jpg", alt: "남산 전망 숙소 3" },
];

const renderGalleryModal = (
  overrides: Partial<
    React.ComponentProps<typeof AccommodationImageGalleryModal>
  > = {},
) => {
  const props: React.ComponentProps<typeof AccommodationImageGalleryModal> = {
    isOpen: true,
    accommodationName: "남산 전망 숙소",
    images,
    currentImageIndex: 1,
    onCurrentImageIndexChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  const view = render(<AccommodationImageGalleryModal {...props} />);

  return { props, ...view };
};

describe("AccommodationImageGalleryModal", () => {
  it("renders the current image and thumbnails", () => {
    renderGalleryModal();

    expect(
      screen.getByRole("dialog", { name: "남산 전망 숙소 사진 갤러리" }),
    ).toBeInTheDocument();
    expect(screen.getAllByAltText("남산 전망 숙소 2")[0]).toHaveAttribute(
      "src",
      "/two.jpg",
    );
    expect(screen.getByAltText("남산 전망 숙소 1")).toHaveAttribute(
      "src",
      "/one.jpg",
    );
    expect(screen.getByAltText("남산 전망 숙소 3")).toHaveAttribute(
      "src",
      "/three.jpg",
    );
  });

  it("keeps the gallery usable when the current image fails", () => {
    renderGalleryModal();

    const currentImage = screen.getAllByAltText("남산 전망 숙소 2").at(0);
    if (!currentImage) {
      throw new Error("Expected the current gallery image to be rendered");
    }
    fireEvent.error(currentImage);

    expect(
      screen.getByRole("img", {
        name: "남산 전망 숙소 2 사진을 불러올 수 없음",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 사진" })).toBeEnabled();
  });

  it("focuses the explicit close control", () => {
    renderGalleryModal();

    expect(
      screen.getByRole("button", { name: "사진 갤러리 닫기" }),
    ).toHaveFocus();
  });

  it("changes images from previous, next, and thumbnail controls", () => {
    const onCurrentImageIndexChange = vi.fn();
    renderGalleryModal({ onCurrentImageIndexChange });

    fireEvent.click(screen.getByRole("button", { name: "이전 사진" }));
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    fireEvent.click(screen.getByAltText("남산 전망 숙소 3"));

    expect(onCurrentImageIndexChange).toHaveBeenNthCalledWith(1, 0);
    expect(onCurrentImageIndexChange).toHaveBeenNthCalledWith(2, 2);
    expect(onCurrentImageIndexChange).toHaveBeenNthCalledWith(3, 2);
  });

  it("wraps previous and next navigation at the image edges", () => {
    const onCurrentImageIndexChange = vi.fn();
    const { rerender } = renderGalleryModal({
      currentImageIndex: 0,
      onCurrentImageIndexChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "이전 사진" }));

    rerender(
      <AccommodationImageGalleryModal
        isOpen
        accommodationName="남산 전망 숙소"
        images={images}
        currentImageIndex={2}
        onCurrentImageIndexChange={onCurrentImageIndexChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));

    expect(onCurrentImageIndexChange).toHaveBeenNthCalledWith(1, 2);
    expect(onCurrentImageIndexChange).toHaveBeenNthCalledWith(2, 0);
  });

  it("closes from the close button, Escape, and backdrop", () => {
    const { props } = renderGalleryModal();

    fireEvent.click(screen.getByRole("button", { name: "사진 갤러리 닫기" }));
    fireEvent.keyDown(
      screen.getByRole("dialog", { name: "남산 전망 숙소 사진 갤러리" }),
      { key: "Escape" },
    );
    fireEvent.mouseDown(screen.getByRole("presentation"));

    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it("renders nothing while closed or empty", () => {
    const { container, rerender } = renderGalleryModal({ isOpen: false });

    expect(container).toBeEmptyDOMElement();

    rerender(
      <AccommodationImageGalleryModal
        isOpen
        accommodationName="남산 전망 숙소"
        images={[]}
        currentImageIndex={0}
        onCurrentImageIndexChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
