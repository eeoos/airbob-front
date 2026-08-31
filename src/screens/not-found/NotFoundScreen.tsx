export interface NotFoundScreenProps {
  readonly title: string;
}

export function NotFoundScreen({ title }: NotFoundScreenProps) {
  return <h1>{title}</h1>;
}
