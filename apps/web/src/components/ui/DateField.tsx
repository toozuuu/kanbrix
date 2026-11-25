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
  error?: string;
  calendarInFlow?: boolean;
}

const formats: Record<string, string> = {
  "yyyy-MM-dd": "Y-m-d",
  "dd/MM/yyyy": "d/m/Y",
  "MM/dd/yyyy": "m/d/Y",
  "MMM d, yyyy": "M j, Y",
};

export function DateField({ label, value, onChange, min, max, required, help, error, calendarInFlow }: DateFieldProps) {
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
    const field = input.current;
    const form = calendarInFlow ? field.form : null;
    const instance = flatpickr(field, {
      static: true,
      disableMobile: true,
      allowInput: true,
      clickOpens: !calendarInFlow,
      ignoredFocusElements: form ? [form] : [],
      dateFormat: activeFormat,
      locale: { firstDayOfWeek: weekStart as 0 | 1 | 6 },
      onChange: dates => notify.current(dates[0] ? flatpickr.formatDate(dates[0], "Y-m-d") : ""),
    });
    picker.current = instance;
    // Collapse after a click so the button under the pointer stays in place.
    const closeOnFormClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && target !== field && !instance.calendarContainer.contains(target)) {
        instance.close();
      }
    };
    form?.addEventListener("click", closeOnFormClick);
    return () => {
      form?.removeEventListener("click", closeOnFormClick);
      instance.destroy();
      picker.current = undefined;
    };
  }, [displayFormat, weekStart, activeFormat, calendarInFlow]);

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

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-foreground/80">
        {label}{required && " *"}
      </label>
      <div className="kanbrix-date-field relative" data-calendar-in-flow={calendarInFlow || undefined}>
        <CalendarDays
          aria-hidden
          className="pointer-events-none absolute z-[1] start-3 top-5 -translate-y-1/2 text-muted-foreground"
          size={16}
        />
        <input
          ref={input}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || help ? id + "-help" : undefined}
          aria-keyshortcuts={calendarInFlow ? "ArrowDown" : undefined}
          placeholder={displayFormat}
          onClick={calendarInFlow ? () => picker.current?.open() : undefined}
          onKeyDown={event => {
            if (event.key === "Enter") event.preventDefault();
            if (calendarInFlow && event.key === "ArrowDown" && !picker.current?.isOpen) {
              event.preventDefault();
              picker.current?.open();
            }
            if (calendarInFlow && event.key === "Escape" && picker.current?.isOpen) {
              event.preventDefault();
              picker.current.close();
            }
          }}
          className={`h-10 w-full rounded-md border bg-card ps-9 pe-9 text-sm transition-all ${error ? "border-destructive" : "border-input"}`}
        />
        {value && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => picker.current?.clear()}
            className="absolute end-2 top-5 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {(error || help || calendarInFlow) && (
        <div className={calendarInFlow ? "min-h-4" : undefined}>
          {error ? <p id={id + "-help"} role="alert" className="text-xs text-destructive">{error}</p>
            : help && <p id={id + "-help"} className="text-xs text-muted-foreground">{help}</p>}
        </div>
      )}
    </div>
  );
}
