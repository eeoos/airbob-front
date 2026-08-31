import { render, screen } from "@testing-library/react";
import type { HomeScreenProps } from "../../../screens/home/HomeScreen";
import HomeRoute from "./HomeRoute";

const mockHomeScreen = vi.fn();

vi.mock("../../../screens/home/public", () => ({
  HomeScreen: (props: HomeScreenProps) => {
    mockHomeScreen(props);
    return <div data-testid="home-screen" />;
  },
}));

describe("HomeRoute", () => {
  it("maps the home hero view model into screen props", () => {
    render(<HomeRoute />);

    expect(screen.getByTestId("home-screen")).toBeInTheDocument();
    expect(mockHomeScreen.mock.calls.at(0)?.at(0)).toEqual({
      subtitle: "전 세계 수백만 개의 숙소 중에서 선택하세요",
      title: "Airbob에서 특별한 숙소를 찾아보세요",
    });
  });
});
