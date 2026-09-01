import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

interface ImageWithFallbackProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "alt" | "onError" | "src"
> {
  readonly alt: string;
  readonly fallback: ReactNode;
  readonly src: string | null | undefined;
}

/**
 * Keeps failed-image state inside React so consumers never need to mutate a
 * sibling element. A changed source gets a fresh deterministic load attempt.
 */
export function ImageWithFallback({
  alt,
  fallback,
  src,
  ...imageProps
}: ImageWithFallbackProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const hasRenderableSource = Boolean(src) && failedSource !== src;

  if (!src || !hasRenderableSource) {
    return fallback;
  }

  return (
    <img
      {...imageProps}
      alt={alt}
      src={src}
      onError={() => setFailedSource(src)}
    />
  );
}
