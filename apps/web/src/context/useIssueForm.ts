import { useConfiguration } from "./useConfiguration";
import { useWorkflow } from "./useWorkflow";
import { ApiError } from "../lib/api";
import type { CustomField } from "../types/configuration";

const builtInIssueForm = {
  types: ["Task", "Bug", "Story", "Epic"],
  priorities: ["Medium", "Lowest", "Low", "High", "Urgent"],
  fields: [] as CustomField[],
  usesBuiltInOptions: true,
};

export function useIssueForm() {
  const { data, error } = useConfiguration();
  const cfg = data?.configuration;
  const form = useWorkflow().data?.form;
  if (!cfg) {
    // The older API returns an empty 404 for this route. Workspace access errors carry a structured code.
    return error instanceof ApiError && error.status === 404 && error.code === "REQUEST_FAILED"
      ? builtInIssueForm
      : undefined;
  }
  if (!cfg.allow_form_overrides || !form) return { ...cfg, usesBuiltInOptions: false };
  const types = cfg.types.filter((t) => form.types?.includes(t));
  const priorities = cfg.priorities.filter((p) => form.priorities?.includes(p));
  return {
    ...cfg,
    usesBuiltInOptions: false,
    types: types.length ? types : cfg.types,
    priorities: priorities.length ? priorities : cfg.priorities,
    fields: cfg.fields.filter(
      (f) => f.required || !form.hidden_fields?.includes(f.id),
    ),
  };
}
