import { useEffect, useId, useRef } from "react";
import flatpickr from "flatpickr";
import { CalendarDays, X } from "lucide-react";
import { useConfiguration } from "../../context/useConfiguration";
import "./DateField.css";

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  help?: string;
}

const formats: Record<string, string> = {
  "yyyy-MM-dd": "Y-m-d",
  "dd/MM/yyyy": "d/m/Y",
  "MM/dd/yyyy": "m/d/Y",
  "MMM d, yyyy": "M j, Y",
};

export function DateField({ label, value, onChange, min, max, required, help }: DateFieldProps) {
  const cfg = useConfiguration().data?.configuration;
  const displayFormat = cfg?.date_format ?? "yyyy-MM-dd";
  const weekStart = cfg?.week_start ?? 1;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<flatpickr.Instance>();
  const notify = useRef(onChange);
  useEffect(() => { notify.current = onChange; }, [onChange]);

  const activeFormat = formats[displayFormat] ?? "Y-m-d";

  useEffect(() => {
    if (!input.current) return;
    const instance = flatpickr(input.current, {
      static: true,
      disableMobile: true,
      allowInput: true,
      dateFormat: activeFormat,
      locale: { firstDayOfWeek: weekStart as 0 | 1 | 6 },
      onChange: dates => notify.current(dates[0] ? flatpickr.formatDate(dates[0], "Y-m-d") : ""),
    });
    picker.current = instance;
    return () => { instance.destroy(); picker.current = undefined; };
  }, [displayFormat, weekStart, activeFormat]);

  useEffect(() => {
    const instance = picker.current;
    if (!instance) return;
    instance.set("minDate", min ? flatpickr.parseDate(min, "Y-m-d") : undefined);
    instance.set("maxDate", max ? flatpickr.parseDate(max, "Y-m-d") : undefined);
    if (!value) {
      instance.clear(false);
    } else {
      instance.setDate(value, false, "Y-m-d");
    }
  }, [value, min, max, displayFormat, weekStart]);

  const handleBlur = () => {
    const instance = picker.current;
    if (!instance || !input.current) return;
    const text = input.current.value.trim();
    if (!text) {
      instance.clear(true);
    } else {
      const parsed = instance.parseDate(text, activeFormat);
      if (parsed) {
        instance.setDate(parsed, true);
      } else {
        instance.setDate(value, false, "Y-m-d");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlur();
      picker.current?.close();
    }
  };

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-foreground/80">
        {label}{required && " *"}
      </label>
      <div className="kanbrix-date-field relative">
        <CalendarDays
          aria-hidden
          className="pointer-events-none absolute z-[1] start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={16}
        />
        <input
          ref={input}
          id={id}
          required={required}
          aria-describedby={help ? id + "-help" : undefined}
          placeholder={displayFormat}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="h-10 w-full rounded-md border border-input bg-card ps-9 pe-9 text-sm  transition-all"
        />
        {value && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => picker.current?.clear()}
            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {help && <p id={id + "-help"} className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
