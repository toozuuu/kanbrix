import { TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-foreground tracking-wide mb-0.5">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? textareaId + "-hint" : undefined}
          ref={ref}
          className={cn(
            "flex w-full rounded-[var(--input-radius)] border bg-card px-3 py-2 text-sm font-medium shadow-sm",
            "placeholder:text-muted-foreground",
            "transition-all duration-200",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-secondary",
            "border-input/80 hover:border-foreground/50",
            error && "border-destructive",
            "resize-y",
            className
          )}
          {...props}
        />
        {error ? (
          <p id={textareaId + "-hint"} className="motion-feedback text-xs text-destructive font-medium">{error}</p>
        ) : helperText ? (
          <p id={textareaId + "-hint"} className="text-xs text-muted-foreground">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";