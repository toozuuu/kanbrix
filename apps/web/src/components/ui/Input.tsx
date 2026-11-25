import { InputHTMLAttributes, forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, type, ...props }, ref) => {
    const { t } = useTranslation();
    const generatedId = useId();
    const inputId = id || generatedId;
    const isPassword = type === "password";
    const [passwordVisible, setPasswordVisible] = useState(false);
    const field = (
      <input
        id={inputId}
        type={isPassword && passwordVisible ? "text" : type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || helperText ? inputId + "-hint" : undefined}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-[var(--input-radius)] border bg-card text-sm font-medium shadow-sm",
          isPassword ? "password-input ps-3 pe-11" : "px-3",
          "placeholder:text-muted-foreground",
          "transition-all duration-200",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-secondary",
          "border-input/80 hover:border-foreground/50",
          error && "border-destructive",
          className
        )}
        {...props}
      />
    );

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-foreground tracking-wide mb-0.5">
            {label}
          </label>
        )}
        {isPassword ? (
          <div className="relative">
            {field}
            <button
              type="button"
              aria-label={t(passwordVisible ? "Hide password" : "Show password")}
              aria-controls={inputId}
              disabled={props.disabled}
              onClick={() => setPasswordVisible(visible => !visible)}
              className="absolute inset-y-px end-px grid w-10 place-items-center rounded-e-[var(--input-radius)] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {passwordVisible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </div>
        ) : field}
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
