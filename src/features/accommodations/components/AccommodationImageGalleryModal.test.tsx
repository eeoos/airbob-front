import { fireEvent, render, screen } from "@testing-library/react";
import { ImageInfo } from "../../../types/accommodation";
import { AccommodationImageGalleryModal } from "./AccommodationImageGalleryModal";

jest.mock("../../../utils/image", () => ({
  getImageUrl: (url: string) => url,
}));

const images: ImageInfo[] = [
  { id: 1, image_url: "/one.jpg" },
  { id: 2, image_url: "/two.jpg" },
  { id: 3, image_url: "/three.jpg" },
];

const renderGalleryModal = (
  overrides: Partial<
    React.ComponentProps<typeof AccommodationImageGalleryModal>
  > = {}
) => {
  const props: React.ComponentProps<typeof AccommodationImageGalleryModal> = {
    isOpen: true,
    accommodationName: "남산 전망 숙소",
    images,
    currentImageIndex: 1,
    onCurrentImageIndexChange: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };

  const view = render(<AccommodationImageGalleryModal {...props} />);

  return { props, ...view };
};

describe("AccommodationImageGalleryModal", () => {
  it("renders the current image and thumbnails", () => {
    renderGalleryModal();

    expect(screen.getAllByAltText("남산 전망 숙소 2")[0]).toHaveAttribute(
      "src",
      "/two.jpg"
    );
    expect(screen.getByAltText("남산 전망 숙소 1")).toHaveAttribute(
      "src",
      "/one.jpg"
    );
    expect(screen.getByAltText("남산 전망 숙소 3")).toHaveAttribute(
      "src",
      "/three.jpg"
    );
  });

  it("changes images from previous, next, and thumbnail controls", () => {
    const onCurrentImageIndexChange = jest.fn();
    renderGalleryModal({ onCurrentImageIndexChange });

    fireEvent.click(screen.getByRole("button", { name: "‹" }));
    fireEvent.click(screen.getByRole("button", { name: "›" }));
    fireEvent.click(screen.getByAltText("남산 전망 숙소 3"));

    expect(onCurrentImageIndexChange).toHaveBeenNthCalledWith(1, 0);
    expect(onCurrentImageIndexChange).toHaveBeenNthCalledWith(2, 2);
    expect(onCurrentImageIndexChange).toHaveBeenNthCalledWith(3, 2);
  });

  it("wraps previous and next navigation at the image edges", () => {
    const onCurrentImageIndexChange = jest.fn();
    const { rerender } = renderGalleryModal({
      currentImageIndex: 0,
      onCurrentImageIndexChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "‹" }));

    rerender(
      <AccommodationImageGalleryModal
        isOpen
        accommodationName="남산 전망 숙소"
        images={images}
        currentImageIndex={2}
        onCurrentImageIndexChange={onCurrentImageIndexChange}
        onClose={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "›" }));

    expect(onCurrentImageIndexChange).toHaveBeenNthCalledWith(1, 2);
    expect(onCurrentImageIndexChange).toHaveBeenNthCalledWith(2, 0);
  });

  it("closes from the close button and backdrop", () => {
    const { props, container } = renderGalleryModal();

    fireEvent.click(screen.getByRole("button", { name: "×" }));
    fireEvent.click(container.firstElementChild as Element);

    expect(props.onClose).toHaveBeenCalledTimes(2);
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
        onCurrentImageIndexChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
