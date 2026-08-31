import { render, screen } from "@testing-library/react";
import { ListContainer } from "./ListContainer";

describe("ListContainer", () => {
  it("owns reusable grid layout values at the shared UI boundary", () => {
    render(
      <ListContainer aria-label="숙소 목록" columns={3} gap={40}>
        <article>숙소</article>
      </ListContainer>,
    );

    expect(screen.getByLabelText("숙소 목록")).toHaveAttribute(
      "data-columns",
      "3",
    );
    expect(screen.getByLabelText("숙소 목록")).toHaveAttribute(
      "data-gap",
      "40",
    );
  });
});
