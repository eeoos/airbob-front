import React from "react";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children inside a generic section element by default", () => {
    render(<Card>숙소 정보</Card>);

    expect(screen.getByText("숙소 정보").tagName).toBe("SECTION");
  });

  it("supports a custom semantic element", () => {
    render(<Card as="article">예약 내역</Card>);

    expect(screen.getByText("예약 내역").tagName).toBe("ARTICLE");
  });

  it("preserves custom class names", () => {
    render(<Card className="reservation-card">예약</Card>);

    expect(screen.getByText("예약")).toHaveClass("reservation-card");
  });
});
