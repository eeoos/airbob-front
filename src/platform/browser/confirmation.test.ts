import { browserConfirmation } from "./confirmation";

describe("browser confirmation", () => {
  it("delegates the exact message to the browser boundary", () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);

    expect(browserConfirmation.confirm("정말 삭제하시겠습니까?")).toBe(true);
    expect(confirm).toHaveBeenCalledWith("정말 삭제하시겠습니까?");

    confirm.mockRestore();
  });
});
