import { fireEvent, render, screen } from "@testing-library/react";
import { ImageWithFallback } from "./ImageWithFallback";

describe("ImageWithFallback", () => {
  it("replaces a failed image through React state", () => {
    const { container } = render(
      <ImageWithFallback
        alt="숙소 사진"
        fallback={<span>이미지 없음</span>}
        src="/broken.jpg"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "숙소 사진" }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("이미지 없음")).toBeInTheDocument();
    // The recipe owns one declarative branch, not hidden sibling markup.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector("[hidden]")).toBeNull();
  });

  it("attempts a changed source after the previous source failed", () => {
    const { rerender } = render(
      <ImageWithFallback
        alt="숙소 사진"
        fallback={<span>이미지 없음</span>}
        src="/first.jpg"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "숙소 사진" }));
    rerender(
      <ImageWithFallback
        alt="숙소 사진"
        fallback={<span>이미지 없음</span>}
        src="/second.jpg"
      />,
    );

    expect(screen.getByRole("img", { name: "숙소 사진" })).toHaveAttribute(
      "src",
      "/second.jpg",
    );
  });

  it("renders the caller-owned accessible fallback when no source exists", () => {
    render(
      <ImageWithFallback
        alt="숙소 사진"
        fallback={<span role="img" aria-label="숙소 이미지 없음" />}
        src={null}
      />,
    );

    expect(
      screen.getByRole("img", { name: "숙소 이미지 없음" }),
    ).toBeInTheDocument();
  });
});
