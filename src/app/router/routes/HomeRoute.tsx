import { getHomeHeroViewModel } from "../../../features/home/public";
import { HomeScreen } from "../../../screens/home/public";

export function HomeRoute() {
  return <HomeScreen {...getHomeHeroViewModel()} />;
}

export default HomeRoute;
