export interface SearchParams {
  destination?: string;
  lat?: number;
  lng?: number;
  viewport?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  checkIn?: Date;
  checkOut?: Date;
  adultOccupancy?: number;
  childOccupancy?: number;
  infantOccupancy?: number;
  petOccupancy?: number;
}
