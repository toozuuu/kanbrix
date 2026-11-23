import { SelectBox } from "./ui/SelectBox";
import type { CustomField, Values } from "../types/configuration";

export const control =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring";
export function CustomFields({
  fields,
  kind,
  values,
  change,
}: {
  fields: CustomField[];
  kind: string;
  values: Values;
  change: (v: Values) => void;
}) {
  return (
    <>
      {fields
        .filter((f) => !f.issue_type || f.issue_type === kind)
        .map((f) => {
          const value = values[f.id];
          const set = (v: Values[string]) => change({ ...values, [f.id]: v });
          if (f.kind === "multi") {
            const selected = Array.isArray(value) ? value : [];
            return (
              <fieldset key={f.id} className="min-w-0 space-y-1 text-sm">
                <legend className="font-medium">{f.label}{f.required && " *"}</legend>
                {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                <div className="select-checklist">
                  {f.options.map((option, index) => (
                    <label key={option}>
                      <input type="checkbox" checked={selected.includes(option)}
                        required={f.required && index === 0 && !selected.length}
                        onChange={event => set(event.target.checked
                          ? [...selected, option] : selected.filter(item => item !== option))} />
                      <span>{f.option_labels?.[option] || option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          }
          return (
            <label key={f.id} className="block space-y-1 text-sm font-medium">
              {f.label}
              {f.required && " *"}
              {f.kind === "select" ? (
                <SelectBox fullWidth
                  required={f.required}
                  value={String(value ?? "")}
                  onChange={e => set(e.target.value)}
                >
                  <option value="">Choose an option</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {f.option_labels?.[o] || o}
                    </option>
                  ))}
                </SelectBox>
              ) : (
                <input
                  className={control}
                  type={f.kind}
                  required={f.required}
                  step={f.kind === "number" ? "any" : undefined}
                  value={String(value ?? "")}
                  onChange={(e) =>
                    set(
                      f.kind === "number" && e.target.value !== ""
                        ? e.target.valueAsNumber
                        : e.target.value,
                    )
                  }
                />
              )}
              {f.help && (
                <span className="block text-xs text-muted-foreground">
                  {f.help}
                </span>
              )}
            </label>
          );
        })}
    </>
  );
}
