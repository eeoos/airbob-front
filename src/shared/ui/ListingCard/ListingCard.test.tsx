import { render, screen } from "@testing-library/react";
import { ListingCard } from "./ListingCard";

describe("ListingCard", () => {
  it("renders listing content with selected state", () => {
    render(
      <ListingCard
        title="서울 한옥"
        subtitle="Mapo, Seoul"
        imageUrl="https://example.com/room.jpg"
        imageAlt="서울 한옥 숙소 사진"
        selected
      />
    );

    expect(screen.getByRole("img", { name: "서울 한옥 숙소 사진" })).toBeInTheDocument();
    expect(screen.getByText("서울 한옥")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("article")).not.toHaveAttribute("aria-selected");
  });

  it("keeps selected as the source of visual selected state", () => {
    render(
      <ListingCard
        title="서울 한옥"
        selected
        aria-selected={false}
      />
    );

    expect(screen.getByRole("article")).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("article")).not.toHaveAttribute("aria-selected");
  });
});
