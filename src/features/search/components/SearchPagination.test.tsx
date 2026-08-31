import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchPagination } from "./SearchPagination";

describe("SearchPagination", () => {
  it("selects a zero-based page index from a visible page button", async () => {
    const onPageChange = vi.fn();

    render(
      <SearchPagination
        currentPage={1}
        totalPages={4}
        isLoading={false}
        onPageChange={onPageChange}
      />,
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
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
  });

  it("marks the active page within a labeled pagination nav", () => {
    render(
      <SearchPagination
        currentPage={1}
        totalPages={4}
        isLoading={false}
        onPageChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "검색 결과 페이지" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps only previous, current, and next controls in compact mode", async () => {
    const onPageChange = vi.fn();

    render(
      <SearchPagination
        currentPage={7}
        totalPages={15}
        isLoading={false}
        onPageChange={onPageChange}
        variant="compact"
      />,
    );

    expect(
      screen.getByRole("status", { name: "현재 8 / 15 페이지" }),
    ).toHaveTextContent("8 / 15");
    expect(screen.queryByRole("button", { name: "8" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "이전" }));
    await userEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(onPageChange.mock.calls).toEqual([[6], [8]]);
  });

  it.each([
    [0, "이전"],
    [3, "다음"],
  ])(
    "disables %s boundary navigation in compact mode",
    (currentPage, label) => {
      render(
        <SearchPagination
          currentPage={currentPage as number}
          totalPages={4}
          isLoading={false}
          onPageChange={vi.fn()}
          variant="compact"
        />,
      );

      expect(
        screen.getByRole("button", { name: label as string }),
      ).toBeDisabled();
    },
  );
});
