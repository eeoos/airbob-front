/**
 * CloudFront 도메인을 사용하여 이미지 URL을 생성합니다.
 * @param imagePath - 이미지 경로 (예: "accommodations/4/image.jpg")
 * @returns 전체 이미지 URL
 */
export const getImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) {
    return ""; // 또는 기본 이미지 URL
  }

  // 이미 전체 URL인 경우 그대로 반환
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  const domain = process.env.REACT_APP_CLOUDFRONT_DOMAIN || "d1wivnghydqg7i.cloudfront.net";
  
  // 경로가 이미 domain을 포함하는 경우
  if (imagePath.includes(domain)) {
    return `https://${imagePath}`;
  }

  // 경로가 /로 시작하지 않으면 추가
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  
  return `https://${domain}${path}`;
};







