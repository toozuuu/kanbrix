import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "success" | "warning";
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "icon";
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", isLoading, children, disabled, fullWidth, ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-md hover:shadow-lg transition-all duration-200",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:shadow-md transition-all duration-200",
      outline: "border border-border bg-transparent hover:bg-accent text-foreground shadow-sm hover:shadow-md transition-all duration-200",
      ghost: "hover:bg-accent text-foreground hover:text-foreground transition-all duration-150",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md hover:shadow-lg transition-all duration-200",
      success: "bg-success text-success-foreground hover:bg-success/90 shadow-md hover:shadow-lg transition-all duration-200",
      warning: "bg-warning text-warning-foreground hover:bg-warning/90 shadow-md hover:shadow-lg transition-all duration-200",
    };

    const sizes = {
      xs: "h-7 px-2.5 text-xs font-medium",
      sm: "h-9 px-3 text-sm font-medium",
      md: "h-10 px-4 text-sm font-semibold",
      lg: "h-11 px-6 text-sm font-semibold",
      xl: "h-12 px-8 text-base font-semibold",
      icon: "h-9 w-9 p-0 flex items-center justify-center rounded-md",
    };

    return (
      <button
        ref={ref}
        aria-busy={isLoading || undefined}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer rounded-md",
          "transform hover:translate-y-0 active:translate-y-0",
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";