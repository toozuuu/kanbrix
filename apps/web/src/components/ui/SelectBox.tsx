import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface SelectBoxProps extends SelectHTMLAttributes<HTMLSelectElement> {
  fullWidth?: boolean;
  compact?: boolean;
}

export const SelectBox = forwardRef<HTMLSelectElement, SelectBoxProps>(
  function SelectBox({ fullWidth, compact, className, children, ...props }, ref) {
    return (
      <span className={`select-box${fullWidth ? " select-box-wide" : ""}${compact ? " select-box-compact" : ""}`}>
        <select {...props} ref={ref} className={className}>{children}</select>
        <ChevronDown aria-hidden="true" size={16} className="select-box-arrow" />
      </span>
    );
  }
);
