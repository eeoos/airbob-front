export interface LoginWireRequest {
  readonly email: string;
  readonly password: string;
}

export interface SignupWireRequest {
  readonly nickname: string;
  readonly email: string;
  readonly password: string;
}

export interface AuthViewerWire {
  readonly id: number;
  readonly email: string;
  readonly nickname: string;
  readonly thumbnail_image_url: string | null;
}
