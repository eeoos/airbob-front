import { PageContainer } from "../../shared/ui";

export interface NotFoundScreenProps {
  readonly title: string;
}

export function NotFoundScreen({ title }: NotFoundScreenProps) {
  return (
    <PageContainer variant="narrow">
      <h1>{title}</h1>
    </PageContainer>
  );
}
