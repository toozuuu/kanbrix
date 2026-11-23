import { useConfiguration } from "../../context/useConfiguration";
import { lazy, Suspense, useId } from "react";

import { format, parseISO } from "date-fns";
import "./DateField.css";
const ReactDatePicker = lazy(() => import("react-datepicker"));


interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

export function DateField({ label, value, onChange, min, max }: DateFieldProps) {
  const cfg=useConfiguration().data?.configuration;
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <Suspense fallback={<div role="status" className="flex h-11 items-center text-sm text-muted-foreground">Loading calendar�</div>}>
      <ReactDatePicker
        id={id}
        selected={value ? parseISO(value) : null}
        onChange={(date: Date | null) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
        minDate={min ? parseISO(min) : undefined}
        maxDate={max ? parseISO(max) : undefined}
        dateFormat={cfg?.date_format??"yyyy-MM-dd"}
        placeholderText={cfg?.date_format??"yyyy-MM-dd"}
        calendarStartDay={(cfg?.week_start??1) as 0|1|6}
        isClearable
        withPortal
        wrapperClassName="w-full"
        className="h-11 w-full rounded-md border border-input bg-card px-3 pr-8 text-sm"
      />
      </Suspense>
    </div>
  );
}
