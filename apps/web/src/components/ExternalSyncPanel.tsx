import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Upload, Download, ArrowRight, CheckCircle2 } from "lucide-react";
import { api, request } from "../lib/api";
import { useWorkspace } from "../context/WorkspaceContext";
import { useToast } from "./ui/Toast";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { SelectBox } from "./ui/SelectBox";
import {
  issuesToCsv,
  parseImportFile,
  type SyncPreviewData,
} from "../lib/syncParsers";

type Provider = "jira" | "github" | "linear" | "file";

const DEFAULT_STATUS_TARGETS = ["Todo", "In Progress", "In Review", "Done"];

function guessTargetStatus(ext: string): string {
  const v = ext.toLowerCase();
  if (v.includes("done") || v.includes("closed") || v.includes("resolved")) return "Done";
  if (v.includes("review")) return "In Review";
  if (v.includes("progress") || v.includes("doing") || v.includes("active")) return "In Progress";
  return "Todo";
}

export function ExternalSyncPanel({ workspaceId }: { workspaceId: string }) {
  const { projects, currentProject, refreshProjects } = useWorkspace();
  const client = useQueryClient();
  const { toast } = useToast();

  const [provider, setProvider] = useState<Provider>("jira");
  const [baseUrl, setBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [target, setTarget] = useState("");
  const [preview, setPreview] = useState<SyncPreviewData | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [importError, setImportError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{
    projectKey: string;
    importedCount: number;
    report: string;
    updated: number;
    skipped: number;
  } | null>(null);

  function applyPreview(data: SyncPreviewData) {
    setImportError("");
    setPreview(data);
    setProjectName(data.project_name);
    setProjectKey(data.project_key);
    setStatusMap(
      Object.fromEntries(data.statuses.map((s) => [s, guessTargetStatus(s)])),
    );
    setLastResult(null);
  }

  async function handleFetchPreview(e: React.FormEvent) {
    e.preventDefault();
    if (provider === "file") return;
    setBusy(true);
    try {
      const data = await request<SyncPreviewData>(
        `/workspaces/${workspaceId}/sync/preview`,
        {
          method: "POST",
          body: JSON.stringify({
            provider,
            base_url: provider === "jira" ? baseUrl.trim() : undefined,
            email: provider === "jira" && email.trim() ? email.trim() : undefined,
            token: token.trim(),
            target: target.trim(),
          }),
        },
      );
      applyPreview(data);
      toast(`Fetched ${data.issues.length} tickets from ${provider}`, "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not fetch external project",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = parseImportFile(file.name, text);
      applyPreview(data);
      toast(`Parsed ${data.issues.length} tickets from ${file.name}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Invalid import file", "error");
    } finally {
      e.target.value = "";
    }
  }

  async function handleImport() {
    if (!preview) return;
    setImportError("");
    setLastResult(null);
    setBusy(true);
    try {
      const res = await request<{
        project_id: string;
        project_key: string;
        imported_count: number;
        outcomes?: {row:number; external_id:string; issue_id?:string; result:string; reason?:string}[];
        updated_count: number;
        skipped_count: number;
      }>(`/workspaces/${workspaceId}/sync/import`, {
        method: "POST",
        body: JSON.stringify({
          target_project_id: targetProjectId || undefined,
          project_name: projectName.trim() || preview.project_name,
          project_key: projectKey.trim() || preview.project_key,
          description: preview.description,
          status_map: statusMap,
          issues: preview.issues,
        }),
      });
      await refreshProjects();
      await client.invalidateQueries();
      setLastResult({
        projectKey: res.project_key,
        importedCount: res.imported_count,
        report: JSON.stringify({project:res.project_key, source:preview.provider,
          created:res.imported_count-res.updated_count, updated:res.updated_count, skipped:res.skipped_count,
          excluded_fields:["attachments","comments","assignees"], outcomes:res.outcomes}, null, 2),
        updated: res.updated_count,
        skipped: res.skipped_count,
      });
      toast(
        `Synced ${res.imported_count} tickets into ${res.project_key}`,
        "success",
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Import failed";
      setImportError(`Could not confirm the import of ${preview.issues.length} tickets. ${reason}`);
      toast(reason, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(format: "csv" | "json") {
    if (!currentProject) return;
    setBusy(true);
    try {
      const issues = await api.issues.list(currentProject.id, { limit: 200 });
      const content =
        format === "csv"
          ? issuesToCsv(issues)
          : JSON.stringify(
              {
                project_name: currentProject.name,
                project_key: currentProject.project_key,
                issues,
              },
              null,
              2,
            );
      const blob = new Blob([content], {
        type: format === "csv" ? "text/csv;charset=utf-8" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentProject.project_key.toLowerCase()}-issues.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Exported ${issues.length} tickets as ${format.toUpperCase()}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6 space-y-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Sync &amp; Import Projects (Jira, GitHub, Linear, CSV/JSON)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pull projects and tickets on demand, map workflow statuses, or export Kanbrix issues. API tokens are used only for the sync request and never stored.
          </p>
        </div>

        {currentProject && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void handleExport("csv")}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void handleExport("json")}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export JSON</span>
            </Button>
          </div>
        )}
      </div>

      {/* Provider Tabs */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sync source">
        {(
          [
            ["jira", "Jira"],
            ["github", "GitHub Issues"],
            ["linear", "Linear"],
            ["file", "CSV / JSON File"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={provider === id ? "default" : "secondary"}
            onClick={() => {
              setProvider(id);
              setPreview(null);
              setLastResult(null);
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      {provider === "file" ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5 text-center space-y-2">
          <Upload className="h-5 w-5 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            Upload a Jira, GitHub, Linear, or Kanbrix CSV / JSON export
          </p>
          <p className="text-xs text-muted-foreground">
            CSV requires a <code>title</code> or <code>summary</code> column (optional: <code>key</code>, <code>description</code>, <code>type</code>, <code>priority</code>, <code>status</code>, <code>labels</code>).
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--button-radius)] bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
            <span>Choose CSV or JSON file</span>
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              onChange={(e) => void handleFileSelect(e)}
            />
          </label>
        </div>
      ) : (
        <form onSubmit={(e) => void handleFetchPreview(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {provider === "jira" && (
            <>
              <Input
                label="Jira Base URL"
                placeholder="https://your-domain.atlassian.net"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required
              />
              <Input
                label="Atlassian Email (optional for Server PAT)"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </>
          )}
          <Input
            label={
              provider === "jira"
                ? "Jira API Token"
                : provider === "github"
                  ? "GitHub Personal Access Token"
                  : "Linear API Key"
            }
            type="password"
            placeholder="Paste token…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
          <Input
            label={
              provider === "jira"
                ? "Jira Project Key"
                : provider === "github"
                  ? "Repository (owner/repo)"
                  : "Linear Team Key"
            }
            placeholder={
              provider === "jira"
                ? "ENG"
                : provider === "github"
                  ? "octocat/hello-world"
                  : "ENG"
            }
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" isLoading={busy} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Fetch &amp; Preview Tickets</span>
            </Button>
          </div>
        </form>
      )}

      {preview && (
        <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Preview: {preview.issues.length} tickets ready to sync
              </h4>
              <p className="text-xs text-muted-foreground">
                Choose a destination project and map external statuses to Kanbrix workflow columns.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-xs font-semibold text-foreground space-y-1">
              <span>Destination</span>
              <SelectBox
                fullWidth
                aria-label="Destination project"
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
              >
                <option value="">Create new project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.project_key})
                  </option>
                ))}
              </SelectBox>
            </label>

            {!targetProjectId && (
              <>
                <Input
                  label="New Project Name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
                <Input
                  label="Project Key"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                />
              </>
            )}
          </div>

          <p>Imports title, description, type, priority, status, labels and source ID. Attachments, comments and assignees are excluded.</p>
          {preview.statuses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Status Mapping</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {preview.statuses.map((extStatus) => (
                  <div
                    key={extStatus}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {extStatus}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <SelectBox
                      aria-label={`Map status ${extStatus}`}
                      value={statusMap[extStatus] ?? "Todo"}
                      onChange={(e) =>
                        setStatusMap((prev) => ({
                          ...prev,
                          [extStatus]: e.target.value,
                        }))
                      }
                    >
                      {DEFAULT_STATUS_TARGETS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </SelectBox>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-card divide-y divide-border/50 text-xs">
            {preview.issues.slice(0, 10).map((issue, idx) => (
              <div key={`${issue.external_id}-${idx}`} className="flex items-center gap-2 px-3 py-2">
                <span className="font-mono text-primary shrink-0">{issue.external_id}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{issue.title}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground shrink-0">
                  {issue.issue_type}
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground shrink-0">
                  {issue.status}
                </span>
              </div>
            ))}
            {preview.issues.length > 10 && (
              <div className="px-3 py-2 text-center text-muted-foreground">
                +{preview.issues.length - 10} more tickets
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              isLoading={busy}
              onClick={() => void handleImport()}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sync {preview.issues.length} Tickets to Kanbrix</span>
            </Button>
            {importError && <p role="alert">{importError}</p>}
            {lastResult && <Button size="sm" variant="outline" onClick={() => {
              const url = URL.createObjectURL(new Blob([lastResult.report], {type:"application/json"}));
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = lastResult.projectKey + "-import-report.json";
              anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}>Download import report</Button>}
            {lastResult && (
              <span role="status" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {lastResult.projectKey}: {lastResult.importedCount - lastResult.updated} created, {lastResult.updated} updated, {lastResult.skipped} skipped (empty title).
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
