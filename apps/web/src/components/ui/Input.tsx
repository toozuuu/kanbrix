import { InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-foreground tracking-wide mb-0.5">
            {label}
          </label>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? inputId + "-hint" : undefined}
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-[var(--input-radius)] border bg-card px-3 text-sm font-medium shadow-sm",
            "placeholder:text-muted-foreground",
            "transition-all duration-200",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-secondary",
            "border-input/80 hover:border-foreground/50",
            error && "border-destructive",
            className
          )}
          {...props}
        />
        {error ? (
          <p id={inputId + "-hint"} className="motion-feedback text-xs text-destructive font-medium">{error}</p>
        ) : helperText ? (
          <p id={inputId + "-hint"} className="text-xs text-muted-foreground">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
