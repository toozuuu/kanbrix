import { ProjectSpinner } from "../components/ui/ProjectSpinner";
import { ProjectEmptyState } from "../components/ui/ProjectEmptyState";
import { SelectBox } from "../components/ui/SelectBox";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { request, api } from "../lib/api";
import { FormOptions } from "../components/FormOptions";
import { Button } from "../components/ui/Button";
import { control } from "../components/CustomFields";
import { useToast } from "../components/ui/Toast";
import { useConfiguration } from "../context/useConfiguration";
import {
  useWorkflow,
  type Column,
  type Workflow,
} from "../context/useWorkflow";
function newColumnId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Self-hosted HTTP deployments still support getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0,8), hex.slice(8,12), hex.slice(12,16), hex.slice(16,20), hex.slice(20)].join("-");
}
export function WorkflowSettings() {
  const { currentProject, currentWorkspace } = useWorkspace();
  const q = useWorkflow();
  if (!currentProject || !currentWorkspace) return <ProjectEmptyState/>;
  if (q.isError && !q.data) return <p role="alert">Could not load workflow settings. <button className="underline" onClick={() => void q.refetch()}>Retry</button></p>;
  if (!q.data) return <ProjectSpinner size="sm" message="Loading workflow settings."/>;
  return (
    <WorkflowEditor
      key={currentProject.id + "-" + q.data.revision}
      initial={q.data}
      project={currentProject.id}
      ws={currentWorkspace.id}
      name={currentProject.name}
    />
  );
}
function WorkflowEditor({
  initial,
  project,
  ws,
  name,
}: {
  initial: Workflow;
  project: string;
  ws: string;
  name: string;
}) {
  const [draft, set] = useState(initial);
  const [destinations, replace] = useState<Record<string, string>>({});
  const [review, preview] = useState(false);
  const [busy, pending] = useState(false);
  const configuration = useConfiguration();
  const cfg = configuration.data?.configuration;
  const [appliedTemplate, setAppliedTemplate] = useState("");
  const client = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const members = useQuery({
    queryKey: ["workflow-members", user?.id, ws],
    queryFn: () => api.workspaces.members(ws),
    enabled: initial.admin,
  });
  const removed = initial.columns.filter(
    (c) => !draft.columns.some((k) => k.id === c.id),
  );
  const needsDestination = removed.some(column => column.issues > 0 &&
    !draft.columns.some(target => target.id === destinations[column.id]));
  function applyTemplate(name: string) {
    const template = cfg?.templates.find(item => item.name === name);
    if (!template) return;
    // Reserve exact matches first so reordering columns in the same category preserves their issues.
    const matches = template.columns.map(column => draft.columns.find(old =>
      old.name === column.name && old.category === column.category));
    const used = new Set(matches.map(column => column?.id));
    const next = template.columns.map((column, index) => {
      const old = matches[index] ?? draft.columns.find(item => item.category === column.category && !used.has(item.id));
      const id = old?.id ?? newColumnId();
      used.add(id);
      return { ...column, id, issues: old?.issues ?? 0 };
    });
    const ids = new Map(next.map(column => [column.name, column.id]));
    const transitions: string[][] = [];
    for (const [from, to] of template.transitions ?? []) {
      const source = ids.get(from), target = ids.get(to);
      if (!source || !target) {
        toast("This template references a missing workflow column.", "error");
        return;
      }
      transitions.push([source, target]);
    }
    set({ ...draft, columns: next, transitions, sprints: template.sprints,
      form: template.form ?? { types: [], priorities: [], hidden_fields: [] } });
    replace({});
    setAppliedTemplate(name);
    preview(false);
  }
  function columns(next: Column[]) {
    set({
      ...draft,
      columns: next,
      transitions: draft.transitions.filter((edge) =>
        edge.every((id) => next.some((c) => c.id === id)),
      ),
    });
    preview(false);
  }
  async function save() {
    pending(true);
    try {
      await request(`/projects/${project}/workflow`, {
        method: "PUT",
        body: JSON.stringify({ ...draft, replacements: Object.fromEntries(removed.filter(column => column.issues > 0).map(column => [column.id, destinations[column.id]])) }),
      });
      await client.invalidateQueries();
      toast("Project workflow published", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Publish failed", "error");
    } finally {
      pending(false);
    }
  }
  return (
    <section className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6 space-y-4 shadow-[var(--shadow-sm)]">
      <h2 className="font-semibold">{name} workflow</h2>
      <fieldset
        disabled={!initial.editable || busy}
        className="space-y-3"
        onChange={() => preview(false)}
      >
        <label className="block text-sm">
          Apply organization template
          <SelectBox fullWidth
            value={appliedTemplate}
            disabled={!cfg?.templates.length}
            onChange={event => applyTemplate(event.target.value)}
          >
            <option value="" disabled>{configuration.isPending ? "Loading templates..." : cfg && !cfg.templates.length ? "No published templates" : "Choose template"}</option>
            {cfg?.templates.map(template => <option key={template.name} value={template.name}>{template.name}</option>)}
          </SelectBox>
        </label>
        {configuration.isError && <p role="alert">Could not load templates. <button className="underline" onClick={() => void configuration.refetch()}>Retry</button></p>}
        {appliedTemplate && <p role="status" className="text-sm text-muted-foreground">{appliedTemplate} applied to the draft. Preview and publish to update this project.</p>}
        {draft.columns.map((c, i) => (
          <div className="flex items-center gap-2" key={c.id}>
            <input
              aria-label="Column name"
              className={control}
              value={c.name}
              onChange={(e) =>
                columns(
                  draft.columns.map((v) =>
                    v.id === c.id ? { ...v, name: e.target.value } : v,
                  ),
                )
              }
            />
            <SelectBox fullWidth
              aria-label="Column category"
              value={c.category}
              onChange={(e) =>
                columns(
                  draft.columns.map((v) =>
                    v.id === c.id ? { ...v, category: e.target.value } : v,
                  ),
                )
              }
            >
              {["Backlog", "Todo", "InProgress", "InReview", "Done"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </SelectBox>
            <button
              aria-label="Move column earlier"
              disabled={!i}
              onClick={() => {
                const next = [...draft.columns];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                columns(next);
              }}
            >
              ↑
            </button>
            <button
              aria-label="Remove column"
              onClick={() =>
                columns(draft.columns.filter((v) => v.id !== c.id))
              }
            >
              ×
            </button>
          </div>
        ))}
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            columns([
              ...draft.columns,
              {
                id: newColumnId(),
                name: "New column",
                category: "Todo",
                issues: 0,
              },
            ])
          }
        >
          Add column
        </Button>
        {removed
          .filter((c) => c.issues > 0)
          .map((c) => (
            <label className="block text-sm" key={c.id}>
              Move {c.issues} issues from {c.name} to
              <SelectBox fullWidth
                value={destinations[c.id] ?? ""}
                onChange={(e) =>
                  replace({ ...destinations, [c.id]: e.target.value })
                }
              >
                <option value="">Choose destination</option>
                {draft.columns.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </SelectBox>
            </label>
          ))}
        <details>
          <summary>
            Allowed transitions ({draft.transitions.length || "all"})
          </summary>
          <p className="text-sm">
            Select individual transitions to restrict moves.
          </p>
          {draft.columns.flatMap((a) =>
            draft.columns
              .filter((b) => a.id !== b.id)
              .map((b) => {
                const on = draft.transitions.some(
                  ([x, y]) => x === a.id && y === b.id,
                );
                return (
                  <label className="block text-sm" key={a.id + b.id}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        set({
                          ...draft,
                          transitions: on
                            ? draft.transitions.filter(
                                ([x, y]) => x !== a.id || y !== b.id,
                              )
                            : [...draft.transitions, [a.id, b.id]],
                        })
                      }
                    />{" "}
                    {a.name} → {b.name}
                  </label>
                );
              }),
          )}
        </details>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={draft.sprints}
            onChange={(e) => set({ ...draft, sprints: e.target.checked })}
          />
          Enable sprints
        </label>
        {cfg?.allow_form_overrides && (
          <FormOptions
            cfg={cfg}
            value={draft.form}
            change={(form) => set({ ...draft, form })}
          />
        )}
        {initial.admin && (
          <details>
            <summary>Delegated workflow administrators</summary>
            <p className="text-xs">
              Enable delegation in organization templates to grant these members
              workflow access.
            </p>
            {members.data
              ?.filter((m) => m.role === "Member")
              .map((m) => (
                <label key={m.user_id} className="block text-sm">
                  <input
                    type="checkbox"
                    checked={draft.delegates.includes(m.user_id)}
                    onChange={(e) =>
                      set({
                        ...draft,
                        delegates: e.target.checked
                          ? [...draft.delegates, m.user_id]
                          : draft.delegates.filter((id) => id !== m.user_id),
                      })
                    }
                  />{" "}
                  {m.name}
                </label>
              ))}
          </details>
        )}
        {review && (
          <p className="text-sm">
            {draft.columns.map((c) => c.name).join(" → ")}. Publishing affects
            this project and moves {removed.reduce((n, c) => n + c.issues, 0)}{" "}
            issues.
          </p>
        )}
        {initial.editable && (
          <Button
            disabled={busy || needsDestination}
            onClick={() => (review ? void save() : preview(true))}
          >
            {review ? "Publish workflow" : "Preview workflow"}
          </Button>
        )}
      </fieldset>
    </section>
  );
}
