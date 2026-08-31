export interface AccommodationDraft {
  readonly id: number;
}

export interface AccommodationDraftApiPort {
  create(): Promise<AccommodationDraft>;
}
