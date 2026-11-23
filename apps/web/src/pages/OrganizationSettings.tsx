import { SelectBox } from "../components/ui/SelectBox";
import {useTranslation} from "react-i18next";
import {useLocation} from "react-router-dom";
import { useState,useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, request } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useConfiguration } from "../context/useConfiguration";
import { useWorkflow } from "../context/useWorkflow";
import { FormOptions } from "../components/FormOptions";
import { Button } from "../components/ui/Button";
import { control } from "../components/CustomFields";
import { useToast } from "../components/ui/Toast";
import type { Configuration, Snapshot } from "../types/configuration";

function Lines({
  label,
  items,
  set,
}: {
  label: string;
  items: string[];
  set: (v: string[]) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <textarea
        className={control}
        rows={3}
        value={items.join("\n")}
        onChange={(e) => set(e.target.value.split("\n"))}
      />
    </label>
  );
}

export function OrganizationSettings() {
  const query = useConfiguration();
  const { currentWorkspace } = useWorkspace();
  if (!currentWorkspace) return null;
  if (query.isError)
    return (
      <Button onClick={() => query.refetch()}>
        Retry organization settings
      </Button>
    );
  if (!query.data) return <p role="status">Loading organization settings…</p>;
  return (
    <Editor
      key={currentWorkspace.id + "-" + query.data.revision}
      ws={currentWorkspace.id}
      snapshot={query.data}
      admin={["Owner", "Admin"].includes(currentWorkspace.role) && !(query.data.configuration.restrictions[currentWorkspace.role]??[]).includes("manage_settings")}
    />
  );
}

function Editor({
  ws,
  snapshot,
  admin,
}: {
  ws: string;
  snapshot: Snapshot;
  admin: boolean;
}) {
  const {t}=useTranslation();
  const [draft, setDraft] = useState<Configuration>(snapshot.configuration);
  const [affected, impact] = useState<number>();
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const {search}=useLocation();
  const [tab,setTab]=useState("Branding");
  useEffect(()=>{const section=new URLSearchParams(search).get("section")??"Branding";setTab(["Branding","Calendar","Issue forms","Templates","Permissions",...(admin?["History"]:[])].includes(section)?section:"Branding");},[search,admin]);
  const { user } = useAuth();
  const workflow = useWorkflow().data;
  const project = useWorkspace().currentProject;
  const owner = useWorkspace().currentWorkspace?.role === "Owner";
  const client = useQueryClient();
  const { toast } = useToast();
  const history = useQuery({
    queryKey: ["configuration-history", user?.id, ws, snapshot.revision],
    queryFn: () => api.configuration.history(ws),
    enabled: admin && tab === "History",
  });
  function set<K extends keyof Configuration>(key: K, value: Configuration[K]) {
    setPreview(false);
    setDraft({ ...draft, [key]: value });
  }
  const changed = (
    Object.keys(snapshot.configuration) as (keyof Configuration)[]
  ).filter(
    (k) =>
      JSON.stringify(draft[k]) !== JSON.stringify(snapshot.configuration[k]),
  );
  async function publish() {
    setBusy(true);
    try {
      const saved = await api.configuration.publish(ws, {
        revision: snapshot.revision,
        configuration: draft,
      });
      client.setQueryData(["configuration", user?.id, ws], saved);
      await client.invalidateQueries({queryKey:["workflow-settings",user?.id,ws]});
      toast("Organization settings published", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Publish failed", "error");
    } finally {
      setBusy(false);
    }
  }
  async function review() {
    setBusy(true);
    try {
      const result = await request<{ issues_missing_required_fields: number }>(
        `/workspaces/${ws}/configuration/preview`,
        { method: "POST", body: JSON.stringify(draft) },
      );
      impact(result.issues_missing_required_fields);
      setPreview(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Preview failed", "error");
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    let published: Configuration;
    try {
      published = await request<Configuration>(
        `/workspaces/${ws}/configuration/export`,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed", "error");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(published, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "kanbrix-configuration.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const tabs = [
    "Branding",
    "Calendar",
    "Issue forms",
    "Templates",
    "Permissions",
    ...(admin ? ["History"] : []),
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div>
        <h2 className="font-semibold">{t("Organization configuration")}</h2>
        <p className="text-sm text-muted-foreground">
          Revision {snapshot.revision}
        </p>
      </div>
      <nav aria-label="Configuration sections" className="flex flex-wrap gap-2">
        {tabs.map((tabName) => (
          <Button
            size="sm"
            variant={tabName === tab ? "default" : "secondary"}
            key={tabName}
            onClick={() => setTab(tabName)}
          >
            {t(tabName)}
          </Button>
        ))}
      </nav>
      <fieldset disabled={!admin || busy} className="space-y-4">
        {tab === "Branding" && (
          <>
            <label className="block text-sm">
              Product name
              <input
                className={control}
                value={draft.brand}
                placeholder="Kanbrix"
                onChange={(e) => set("brand", e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Logo URL (HTTPS)
              <input
                className={control}
                type="url"
                value={draft.logo}
                onChange={(e) => set("logo", e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Accent color
              <input
                className={control}
                placeholder="#216bca"
                value={draft.accent}
                onChange={(e) => set("accent", e.target.value)}
              />
            </label>
            <div
              className="flex items-center gap-3 rounded-lg border-l-4 bg-secondary p-3"
              style={{ borderColor: draft.accent }}
            >
              {draft.logo.startsWith("https://") && (
                <img
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 object-contain"
                  src={draft.logo}
                  alt=""
                />
              )}
              {draft.brand || "Kanbrix"}
            </div>
          </>
        )}
        {tab === "Calendar" && (
          <>
            <label className="block text-sm">
              {t("Time zone")}
              <input
                className={control}
                value={draft.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Date format
              <SelectBox fullWidth
                value={draft.date_format}
                onChange={(e) => set("date_format", e.target.value)}
              >
                {["yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </SelectBox>
            </label>
            <label className="block text-sm">
              Week starts on
              <SelectBox fullWidth
                value={draft.week_start}
                onChange={(e) => set("week_start", +e.target.value)}
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={6}>Saturday</option>
              </SelectBox>
            </label>
          </>
        )}
        {tab === "Issue forms" && (
          <>
            <Lines
              label="Issue types, one per line"
              items={draft.types}
              set={(v) => set("types", v)}
            />
            <Lines
              label="Priorities, default first"
              items={draft.priorities}
              set={(v) => set("priorities", v)}
            />
            {draft.fields.map((f, i) => {
              const update = (patch: Partial<typeof f>) =>
                set(
                  "fields",
                  draft.fields.map((v, n) =>
                    n === i ? { ...v, ...patch } : v,
                  ),
                );
              return (
                <div
                  key={f.id}
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <label className="block text-sm">
                    Field label
                    <input
                      className={control}
                      value={f.label}
                      onChange={(e) => update({ label: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    Help text
                    <input
                      className={control}
                      value={f.help ?? ""}
                      onChange={(e) => update({ help: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    Field type
                    <SelectBox fullWidth
                      disabled={snapshot.configuration.fields.some(
                        (v) => v.id === f.id,
                      )}
                      value={f.kind}
                      onChange={(e) => update({ kind: e.target.value })}
                    >
                      {["text", "number", "date", "select", "multi"].map(
                        (k) => (
                          <option key={k}>{k}</option>
                        ),
                      )}
                    </SelectBox>
                  </label>
                  {["select", "multi"].includes(f.kind) && (
                    <Lines
                      label="Options, one per line"
                      items={f.options}
                      set={(options) => update({ options })}
                    />
                  )}
                  {["select", "multi"].includes(f.kind) &&
                    f.options.filter(Boolean).map((id) => (
                      <label className="block text-sm" key={id}>
                        Display label for {id}
                        <input
                          className={control}
                          value={f.option_labels?.[id] ?? id}
                          onChange={(e) =>
                            update({
                              option_labels: {
                                ...f.option_labels,
                                [id]: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  {i > 0 && (
                    <button
                      onClick={() => {
                        const next = [...draft.fields];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        set("fields", next);
                      }}
                    >
                      Move earlier
                    </button>
                  )}
                  <label className="block text-sm">
                    Applies to
                    <SelectBox fullWidth
                      value={f.issue_type}
                      onChange={(e) => update({ issue_type: e.target.value })}
                    >
                      <option value="">All issue types</option>
                      {draft.types.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </SelectBox>
                  </label>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => update({ required: e.target.checked })}
                    />
                    Required
                  </label>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      set(
                        "fields",
                        draft.fields.filter((v) => v.id !== f.id),
                      )
                    }
                  >
                    Archive field
                  </Button>
                </div>
              );
            })}
            <Button
              size="sm"
              onClick={() =>
                set("fields", [
                  ...draft.fields,
                  {
                    id: crypto.randomUUID(),
                    label: "New field",
                    kind: "text",
                    required: false,
                    issue_type: "",
                    options: [],
                  },
                ])
              }
            >
              Add field
            </Button>
          </>
        )}
        {tab === "Templates" && (
          <>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={draft.allow_form_overrides}
                onChange={(e) => set("allow_form_overrides", e.target.checked)}
              />
              Allow projects to narrow issue forms. Required fields always
              apply.
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={draft.delegate_workflows}
                onChange={(e) => set("delegate_workflows", e.target.checked)}
              />
              Allow delegated project admins to publish workflow overrides
            </label>
            <p className="text-sm text-muted-foreground">
              New projects use the first template by default. Existing projects
              keep their workflow.
            </p>
            {draft.templates.map((t, i) => {
              const update = (patch: Partial<typeof t>) =>
                set(
                  "templates",
                  draft.templates.map((v, n) =>
                    n === i
                      ? {
                          ...v,
                          ...patch,
                          transitions: (v.transitions ?? []).filter((edge) =>
                            edge.every((name) =>
                              (patch.columns ?? v.columns).some(
                                (c) => c.name === name,
                              ),
                            ),
                          ),
                        }
                      : v,
                  ),
                );
              return (
                <div
                  key={i}
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <label className="block text-sm">
                    Template name
                    <input
                      className={control}
                      value={t.name}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </label>
                  {t.columns.map((c, j) => (
                    <div key={j} className="flex gap-2">
                      <input
                        aria-label="Column name"
                        className={control}
                        value={c.name}
                        onChange={(e) =>
                          update({
                            columns: t.columns.map((v, n) =>
                              n === j ? { ...v, name: e.target.value } : v,
                            ),
                          })
                        }
                      />
                      <SelectBox fullWidth
                        aria-label="Workflow category"
                        value={c.category}
                        onChange={(e) =>
                          update({
                            columns: t.columns.map((v, n) =>
                              n === j ? { ...v, category: e.target.value } : v,
                            ),
                          })
                        }
                      >
                        {[
                          "Backlog",
                          "Todo",
                          "InProgress",
                          "InReview",
                          "Done",
                        ].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </SelectBox>
                      <button
                        aria-label="Remove column"
                        onClick={() =>
                          update({
                            columns: t.columns.filter((_, n) => n !== j),
                          })
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
                      update({
                        columns: [
                          ...t.columns,
                          { name: "New column", category: "Todo" },
                        ],
                      })
                    }
                  >
                    Add column
                  </Button>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={t.sprints}
                      onChange={(e) => update({ sprints: e.target.checked })}
                    />
                    Enable sprints
                  </label>
                  {draft.allow_form_overrides && (
                    <FormOptions
                      cfg={draft}
                      value={t.form}
                      change={(form) => update({ form })}
                    />
                  )}
                  <button
                    className="text-sm underline"
                    onClick={() =>
                      set(
                        "templates",
                        draft.templates.filter((_, n) => n !== i),
                      )
                    }
                  >
                    Remove template
                  </button>
                </div>
              );
            })}
            <Button
              size="sm"
              onClick={() =>
                set("templates", [
                  ...draft.templates,
                  {
                    name: "New template",
                    sprints: false,
                    columns: [
                      { name: "Open", category: "Todo" },
                      { name: "Resolved", category: "Done" },
                    ],
                  },
                ])
              }
            >
              Add template
            </Button>
            {workflow && project && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  set("templates", [
                    ...draft.templates,
                    {
                      name: project.name,
                      columns: workflow.columns.map(({ name, category }) => ({
                        name,
                        category,
                      })),
                      sprints: workflow.sprints,
                      form: workflow.form,
                      transitions: workflow.transitions.map((edge) =>
                        edge.map(
                          (id) =>
                            workflow.columns.find((c) => c.id === id)!.name,
                        ),
                      ),
                    },
                  ])
                }
              >
                Save current project as template
              </Button>
            )}
          </>
        )}
        {tab === "Permissions" && (
          <table className="w-full text-left text-sm">
            <caption>Role permissions. Owners retain recovery access.</caption>
            <thead>
              <tr>
                <th>Permission</th>
                <th>Admin</th>
                <th>Member</th>
              </tr>
            </thead>
            <tbody>
              {[
                "edit_issues",
                "create_projects",
                "manage_sprints",
                "manage_members",
                "manage_settings",
                "manage_workflows",
                "manage_integrations",
                "export_configuration",
              ].map((p) => (
                <tr key={p}>
                  <td>{p.replace(/_/g, " ")}</td>
                  {["Admin", "Member"].map((r) => {
                    const available =
                      r === "Admin" ||
                      [
                        "edit_issues",
                        "create_projects",
                        "manage_sprints",
                      ].includes(p) ||
                      (p === "manage_workflows" && draft.delegate_workflows);
                    const list = draft.restrictions[r] ?? [];
                    return (
                      <td key={r}>
                        <input
                          aria-label={r + " " + p}
                          type="checkbox"
                          checked={available && !list.includes(p)}
                          disabled={!available || !owner}
                          onChange={(e) =>
                            set("restrictions", {
                              ...draft.restrictions,
                              [r]: e.target.checked
                                ? list.filter((v) => v !== p)
                                : [...list, p],
                            })
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "History" && (
          <>
            <Button size="sm" variant="secondary" onClick={download}>
              Export published configuration
            </Button>
            <label className="block text-sm">
              Import configuration
              <input
                className={control}
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 200000) throw Error();
                    const v = JSON.parse(await file.text());
                    if (
                      v.version !== 1 ||
                      !Object.keys(snapshot.configuration).every(
                        (k) =>
                          typeof v[k] ===
                          typeof snapshot.configuration[
                            k as keyof Configuration
                          ],
                      ) ||
                      !Array.isArray(v.fields) ||
                      !Array.isArray(v.templates)
                    )
                      throw Error();
                    await api.configuration.validate(ws, v);
                    setDraft(v);
                    setPreview(false);
                  } catch {
                    toast("Invalid configuration file", "error");
                  }
                }}
              />
            </label>
            {history.data?.map((r) => (
              <div
                className="flex justify-between gap-2 border-b border-border py-2"
                key={r.revision}
              >
                <span>
                  Revision {r.revision} · {r.author} ·{" "}
                  {r.created_at &&
                    new Date(r.created_at).toLocaleString(undefined, {
                      timeZone: snapshot.configuration.timezone,
                    })}
                </span>
                <button
                  disabled={r.revision === snapshot.revision}
                  onClick={() => {
                    setDraft(r.configuration);
                    setPreview(false);
                  }}
                >
                  Restore draft
                </button>
              </div>
            ))}
          </>
        )}
      </fieldset>
      {admin && changed.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          {preview && (
            <p className="text-sm">
              Publishing changes to {changed.join(", ")}.{" "}
              {affected !== undefined && (
                <>
                  {affected} existing open issues need field values on their
                  next edit.
                </>
              )}
            </p>
          )}
          <Button
            isLoading={busy}
            onClick={() => (preview ? void publish() : void review())}
          >
            {preview ? "Publish configuration" : "Review changes"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(snapshot.configuration);
              setPreview(false);
            }}
          >
            Discard draft
          </Button>
        </div>
      )}
    </section>
  );
}
