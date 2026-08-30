export interface ReviewImageWire {
  readonly id: number;
  readonly image_url: string;
}

export interface ReviewAuthorWire {
  readonly id: number;
  readonly nickname: string;
  readonly thumbnail_image_url: string | null;
}

export interface ReviewWire {
  readonly id: number;
  readonly rating: number;
  readonly content: string;
  readonly reviewed_at: string;
  readonly reviewer: ReviewAuthorWire;
  readonly images: readonly ReviewImageWire[];
}

export interface CursorPageInfoWire {
  readonly has_next: boolean;
  readonly next_cursor: string | null;
  readonly current_size: number;
}

export interface ReviewPageWire {
  readonly reviews: readonly ReviewWire[];
  readonly page_info: CursorPageInfoWire;
}

export interface CreateReviewWireRequest {
  readonly rating: number;
  readonly content: string;
}

export interface CreatedReviewWire {
  readonly id: number;
}

export interface UploadedReviewImagesWire {
  readonly uploaded_images: readonly ReviewImageWire[];
}
