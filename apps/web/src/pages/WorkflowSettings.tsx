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
export function WorkflowSettings() {
  const { currentProject, currentWorkspace } = useWorkspace();
  const q = useWorkflow();
  if (!q.data || !currentProject || !currentWorkspace) return null;
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
  const cfg = useConfiguration().data?.configuration;
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
        body: JSON.stringify({ ...draft, replacements: destinations }),
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
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold">{name} workflow</h2>
      <fieldset
        disabled={!initial.editable || busy}
        className="space-y-3"
        onChange={() => preview(false)}
      >
        <label className="block text-sm">
          Apply organization template
          <SelectBox fullWidth
            value=""
            onChange={(e) => {
              const t = cfg?.templates.find((t) => t.name === e.target.value);
              if (t) {
                const used = new Set<string>();
                const cols = t.columns.map((c) => {
                  const old = draft.columns.find(
                    (v) => v.category === c.category && !used.has(v.id),
                  );
                  const id = old?.id ?? crypto.randomUUID();
                  used.add(id);
                  return { ...c, id, issues: old?.issues ?? 0 };
                });
                set({
                  ...draft,
                  columns: cols,
                  form: t.form ?? {
                    types: [],
                    priorities: [],
                    hidden_fields: [],
                  },
                  sprints: t.sprints,
                  transitions: (t.transitions ?? []).map((edge) =>
                    edge.map((n) => cols.find((c) => c.name === n)!.id),
                  ),
                });
              }
            }}
          >
            <option value="">Choose template</option>
            {cfg?.templates.map((t) => (
              <option key={t.name}>{t.name}</option>
            ))}
          </SelectBox>
        </label>
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
                id: crypto.randomUUID(),
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
            disabled={busy}
            onClick={() => (review ? void save() : preview(true))}
          >
            {review ? "Publish workflow" : "Preview workflow"}
          </Button>
        )}
      </fieldset>
    </section>
  );
}
