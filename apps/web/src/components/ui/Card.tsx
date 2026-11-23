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
        "rounded-xl border border-border bg-card text-foreground shadow-sm",
        "hover:shadow-md transition-all duration-200",
        className
      )}
    >
      {header && (
        <div className="border-b border-border/50 px-6 py-4 first:rounded-t-xl last:rounded-b-none">
          {header}
        </div>
      )}
      <div className={cn("px-6 py-4", header && "pb-0", footer && "pt-0")}>
        {children}
      </div>
      {footer && (
        <div className="border-t border-border/50 px-6 py-4 first:rounded-b-xl last:rounded-t-none">
          {footer}
        </div>
      )}
    </div>
  );
}