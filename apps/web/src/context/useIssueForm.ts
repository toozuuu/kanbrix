import { useConfiguration } from "./useConfiguration";
import { useWorkflow } from "./useWorkflow";
export function useIssueForm() {
  const cfg = useConfiguration().data?.configuration;
  const form = useWorkflow().data?.form;
  if (!cfg?.allow_form_overrides || !form) return cfg;
  const types = cfg.types.filter((t) => form.types?.includes(t));
  const priorities = cfg.priorities.filter((p) => form.priorities?.includes(p));
  return {
    ...cfg,
    types: types.length ? types : cfg.types,
    priorities: priorities.length ? priorities : cfg.priorities,
    fields: cfg.fields.filter(
      (f) => f.required || !form.hidden_fields?.includes(f.id),
    ),
  };
}
