import { getHomeHeroViewModel } from "../../../features/home/public";
import { HomeScreen } from "../../../screens/home/public";
import { HomeLoginModal } from "../HomeLoginModal";

function HomeRoute() {
  return (
    <>
      <HomeScreen {...getHomeHeroViewModel()} />
      <HomeLoginModal />
    </>
  );
}

export default HomeRoute;
