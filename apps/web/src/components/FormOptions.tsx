import type { Configuration, FormOverrides } from "../types/configuration";
const empty: FormOverrides = { types: [], priorities: [], hidden_fields: [] };
export function FormOptions({
  cfg,
  value,
  change,
}: {
  cfg: Configuration;
  value?: FormOverrides;
  change: (v: FormOverrides) => void;
}) {
  const v = { ...empty, ...value };
  return (
    <details>
      <summary>Project issue form</summary>
      {(["types", "priorities"] as const).map((key) => (
        <fieldset key={key}>
          <legend>
            {key} ·{" "}
            {v[key].length ? "Project selection" : "Organization default"}
          </legend>
          {cfg[key].map((item) => (
            <label key={item} className="mr-3 inline-flex gap-1 text-sm">
              <input
                type="checkbox"
                checked={!v[key].length || v[key].includes(item)}
                onChange={(e) => {
                  const selection = v[key].length ? v[key] : cfg[key];
                  change({
                    ...v,
                    [key]: e.target.checked
                      ? [...selection, item]
                      : selection.filter((k) => k !== item),
                  });
                }}
              />
              {item}
            </label>
          ))}
        </fieldset>
      ))}
      <fieldset>
        <legend>Visible fields</legend>
        {cfg.fields.map((f) => (
          <label key={f.id} className="block text-sm">
            <input
              type="checkbox"
              disabled={f.required}
              checked={f.required || !v.hidden_fields.includes(f.id)}
              onChange={(e) =>
                change({
                  ...v,
                  hidden_fields: e.target.checked
                    ? v.hidden_fields.filter((k) => k !== f.id)
                    : [...v.hidden_fields, f.id],
                })
              }
            />{" "}
            {f.label}
          </label>
        ))}
      </fieldset>
      <button onClick={() => change(empty)}>
        Reset to organization defaults
      </button>
    </details>
  );
}
