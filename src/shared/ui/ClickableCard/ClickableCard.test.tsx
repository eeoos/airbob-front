import React from "react";
import { render, screen } from "@testing-library/react";
import { ClickableCard } from "./ClickableCard";

describe("ClickableCard", () => {
  it("renders an accessible button and triggers the card action", () => {
    const handleClick = jest.fn();

    render(
      <ClickableCard ariaLabel="숙소 관리 열기" onClick={handleClick}>
        <span>숙소 카드</span>
      </ClickableCard>
    );

    const card = screen.getByRole("button", { name: "숙소 관리 열기" });

    expect(card).toHaveAttribute("type", "button");
    card.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not trigger the card action from a nested action control", () => {
    const handleCardClick = jest.fn();
    const handleActionClick = jest.fn();

    render(
      <ClickableCard ariaLabel="숙소 관리 열기" onClick={handleCardClick}>
        <span>숙소 카드</span>
        <span role="button" tabIndex={0} onClick={handleActionClick}>
          삭제
        </span>
      </ClickableCard>
    );

    screen.getByRole("button", { name: "삭제" }).click();

    expect(handleActionClick).toHaveBeenCalledTimes(1);
    expect(handleCardClick).not.toHaveBeenCalled();
  });
});
