import { fireEvent, render, screen } from "@testing-library/react";
import { ActionCard, NavigationCard } from "./InteractiveCard";

describe("interactive card semantics", () => {
  it("renders navigation content and optional actions outside the primary anchor", () => {
    const onNavigate = vi.fn((event) => event.preventDefault());
    const onSave = vi.fn();

    render(
      <NavigationCard
        actions={
          <button type="button" onClick={onSave}>
            저장
          </button>
        }
        ariaLabel="예약 상세 보기"
        href="/reservations/reservation-1"
        onClick={onNavigate}
      >
        <span>예약 카드</span>
      </NavigationCard>,
    );

    const article = screen.getByRole("article");
    const primaryLink = screen.getByRole("link", { name: "예약 상세 보기" });
    const secondaryAction = screen.getByRole("button", { name: "저장" });
    const content = screen.getByText("예약 카드");

    expect(primaryLink).toHaveAttribute("href", "/reservations/reservation-1");
    expect(article).toContainElement(primaryLink);
    expect(article).toContainElement(secondaryAction);
    expect(primaryLink).not.toContainElement(content);
    expect(primaryLink).not.toContainElement(secondaryAction);

    fireEvent.click(secondaryAction);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.click(primaryLink);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("renders action content and optional actions outside the primary button", () => {
    const onPrimaryAction = vi.fn();

    render(
      <ActionCard
        actions={<a href="/help">도움말</a>}
        ariaLabel="숙소 관리 열기"
        onClick={onPrimaryAction}
      >
        <span>숙소 카드</span>
      </ActionCard>,
    );

    const article = screen.getByRole("article");
    const primaryButton = screen.getByRole("button", {
      name: "숙소 관리 열기",
    });
    const secondaryAction = screen.getByRole("link", { name: "도움말" });
    const content = screen.getByText("숙소 카드");

    expect(primaryButton).toHaveAttribute("type", "button");
    expect(article).toContainElement(primaryButton);
    expect(article).toContainElement(secondaryAction);
    expect(primaryButton).not.toContainElement(content);
    expect(primaryButton).not.toContainElement(secondaryAction);

    fireEvent.click(primaryButton);
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });
});
