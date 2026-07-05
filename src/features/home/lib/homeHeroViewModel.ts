export interface HomeHeroViewModel {
  subtitle: string;
  title: string;
}

export const getHomeHeroViewModel = (): HomeHeroViewModel => ({
  subtitle: "전 세계 수백만 개의 숙소 중에서 선택하세요",
  title: "Airbob에서 특별한 숙소를 찾아보세요",
});
