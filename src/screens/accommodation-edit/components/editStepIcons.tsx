import React from "react";

interface IconFrameProps {
  children: React.ReactNode;
  strokeWidth?: string;
}

export const IconFrame = ({ children, strokeWidth = "1.5" }: IconFrameProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
    {children}
  </svg>
);

export const TimeIcon = () => (
  <IconFrame strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </IconFrame>
);
