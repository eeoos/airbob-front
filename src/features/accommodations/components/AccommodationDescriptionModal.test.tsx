import { fireEvent, render, screen } from "@testing-library/react";
import { AccommodationDescriptionModal } from "./AccommodationDescriptionModal";

const renderDescriptionModal = (
  overrides: Partial<
    React.ComponentProps<typeof AccommodationDescriptionModal>
  > = {}
) => {
  const props: React.ComponentProps<typeof AccommodationDescriptionModal> = {
    isOpen: true,
    description: "첫 번째 줄\n두 번째 줄",
    onClose: jest.fn(),
    ...overrides,
  };

  const view = render(<AccommodationDescriptionModal {...props} />);

  return { props, ...view };
};

describe("AccommodationDescriptionModal", () => {
  it("renders multiline description content", () => {
    renderDescriptionModal();

    expect(screen.getByRole("heading", { name: "숙소 설명" })).toBeInTheDocument();
    expect(screen.getByText("첫 번째 줄")).toBeInTheDocument();
    expect(screen.getByText("두 번째 줄")).toBeInTheDocument();
  });

  it("closes from the close button and backdrop", () => {
    const { props, container } = renderDescriptionModal();

    fireEvent.click(screen.getByRole("button", { name: "×" }));
    fireEvent.click(container.firstElementChild as Element);

    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close when the content panel is clicked", () => {
    const { props } = renderDescriptionModal();

    fireEvent.click(screen.getByRole("heading", { name: "숙소 설명" }));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("renders nothing while closed", () => {
    const { container } = renderDescriptionModal({ isOpen: false });

    expect(container).toBeEmptyDOMElement();
  });
});
