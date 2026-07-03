import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchPagination } from "./SearchPagination";

describe("SearchPagination", () => {
  it("selects a zero-based page index from a visible page button", async () => {
    const onPageChange = jest.fn();

    render(
      <SearchPagination
        currentPage={1}
        totalPages={4}
        isLoading={false}
        onPageChange={onPageChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "3" }));

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables previous navigation on the first page", () => {
    render(
      <SearchPagination
        currentPage={0}
        totalPages={4}
        isLoading={false}
        onPageChange={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
  });
});
