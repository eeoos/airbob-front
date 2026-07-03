import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BaseAccommodationCard } from "./BaseAccommodationCard";

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => jest.fn(),
  }),
  { virtual: true }
);

const renderCard = (onClick = jest.fn()) => {
  render(
    <BaseAccommodationCard
      id={1}
      name="성수 숙소"
      thumbnailUrl={null}
      locationSummary="서울"
      onClick={onClick}
    />
  );

  return onClick;
};

describe("BaseAccommodationCard", () => {
  it("exposes the card action as a keyboard-accessible button", async () => {
    const onClick = renderCard();
    const cardButton = screen.getByRole("button", {
      name: "숙소 상세 보기: 성수 숙소",
    });

    cardButton.focus();
    await userEvent.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
