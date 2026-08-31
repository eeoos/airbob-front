export interface AuthViewerWire {
  readonly id: number;
  readonly email: string;
  readonly nickname: string;
  readonly thumbnail_image_url: string | null;
}
