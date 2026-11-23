import { Children, forwardRef, isValidElement, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface SelectBoxProps extends SelectHTMLAttributes<HTMLSelectElement> {
  fullWidth?: boolean;
  unavailableLabel?: string;
}

function hasOption(children: ReactNode, value: string): boolean {
  return Children.toArray(children).some(child => {
    if (!isValidElement(child)) return false;
    if (child.type === "option") {
      const optionValue = child.props.value ?? Children.toArray(child.props.children).join("");
      return String(optionValue) === value;
    }
    return hasOption(child.props.children, value);
  });
}

export const SelectBox = forwardRef<HTMLSelectElement, SelectBoxProps>(
  function SelectBox({ fullWidth, unavailableLabel, className, children, ...props }, ref) {
    const value = props.value;
    const missingValue = value != null && !Array.isArray(value) && !hasOption(children, String(value));
    return (
      <span className={`select-box${fullWidth ? " select-box-wide" : ""}`}>
        <select {...props} ref={ref} className={className}>
          {missingValue && <option value={value} disabled>{unavailableLabel ?? (value === "" ? "Choose an option" : "Selection unavailable")}</option>}
          {children}
        </select>
        <ChevronDown aria-hidden="true" size={16} className="select-box-arrow" />
      </span>
    );
  }
);
