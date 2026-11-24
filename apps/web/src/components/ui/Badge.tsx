import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "success" | "warning";
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Badge({
  variant = "default",
  size = "md",
  className,
  children,
  style,
}: BadgeProps) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary-hover",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border border-border bg-transparent hover:bg-accent text-foreground",
    ghost: "hover:bg-accent hover:text-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    success: "bg-success text-success-foreground hover:bg-success/90",
    warning: "bg-warning text-warning-foreground hover:bg-warning/90",
  };

  const sizes = {
    sm: "text-xs font-medium px-2.5 py-0.5",
    md: "text-sm font-semibold px-3 py-1",
    lg: "text-sm font-semibold px-4 py-1.5",
  };

  const defaultStyle: React.CSSProperties = {};
  if (style?.backgroundColor && variant === "outline") {
    defaultStyle.color = style.color || "#ffffff";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-all duration-200",
          "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      style={{ ...defaultStyle, ...style }}
    >
      {children}
    </span>
  );
}