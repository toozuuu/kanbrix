import React from "react";
import { cn } from "../../lib/utils";

export interface CardProps {
  className?: string;
  children?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Card({ className, children, header, footer }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--card-radius)] border border-border/75 bg-card text-foreground shadow-[var(--shadow-sm)]",
        className
      )}
    >
      {header && (
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/[0.03] to-transparent px-6 py-4 first:rounded-t-2xl last:rounded-b-none">
          {header}
        </div>
      )}
      <div className={cn("px-6 py-4", header && "pb-4", footer && "pt-4")}>
        {children}
      </div>
      {footer && (
        <div className="border-t border-border/60 bg-secondary/20 px-6 py-3.5 first:rounded-b-2xl last:rounded-t-none">
          {footer}
        </div>
      )}
    </div>
  );
}