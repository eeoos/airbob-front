import type { AuthViewer } from "../model/auth";
import type { AuthViewerWire } from "./wire";

export const toAuthViewer = (wire: AuthViewerWire): AuthViewer => ({
  id: wire.id,
  email: wire.email,
  nickname: wire.nickname,
  thumbnailImageUrl: wire.thumbnail_image_url,
});
