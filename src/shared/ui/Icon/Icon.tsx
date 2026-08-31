import type { CSSProperties, ReactNode, SVGProps } from "react";

export interface IconGlyph {
  children: ReactNode;
  fill?: "none" | "currentColor";
  stroke?: "none" | "currentColor";
  strokeWidth?: number | string;
  viewBox?: string;
}

type IconAccessibilityProps =
  | {
      decorative: true;
      label?: never;
    }
  | {
      decorative: false;
      label: string;
    };

type IconSvgProps = Omit<
  SVGProps<SVGSVGElement>,
  | "aria-hidden"
  | "aria-label"
  | "children"
  | "fill"
  | "focusable"
  | "height"
  | "role"
  | "stroke"
  | "strokeWidth"
  | "viewBox"
  | "width"
>;

type IconSize = number | string;

export type IconProps = IconSvgProps &
  IconAccessibilityProps & {
    glyph: IconGlyph;
    size: IconSize;
    strokeWidth?: number | string;
  };

export const Icon = ({
  decorative,
  glyph,
  label,
  size,
  strokeWidth,
  style,
  ...svgProps
}: IconProps) => {
  const sizingStyle: CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    ...style,
  };

  return (
    <svg
      {...svgProps}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      fill={glyph.fill ?? "none"}
      focusable="false"
      role={decorative ? undefined : "img"}
      stroke={glyph.stroke ?? "currentColor"}
      strokeWidth={strokeWidth ?? glyph.strokeWidth}
      style={sizingStyle}
      viewBox={glyph.viewBox ?? "0 0 24 24"}
    >
      {glyph.children}
    </svg>
  );
};
