export interface SyncIssueItem {
  external_id: string;
  title: string;
  description?: string | null;
  issue_type: string;
  priority: string;
  status: string;
  labels: string[];
}

export interface SyncPreviewData {
  provider: string;
  project_name: string;
  project_key: string;
  description?: string | null;
  statuses: string[];
  issues: SyncIssueItem[];
}

function normalizePriority(raw?: string): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (["highest", "critical", "urgent", "p0"].includes(v)) return "critical";
  if (["high", "p1"].includes(v)) return "high";
  if (["low", "lowest", "p3", "p4"].includes(v)) return "low";
  return "medium";
}

function normalizeType(raw?: string): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (["bug", "defect", "incident"].includes(v)) return "bug";
  if (["story", "feature", "enhancement"].includes(v)) return "feature";
  if (v === "epic") return "epic";
  return "task";
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function parseImportFile(
  filename: string,
  content: string,
): SyncPreviewData {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("The selected file is empty.");
  }

  const baseName = filename.replace(/\.[^.]+$/, "") || "Imported Project";
  const defaultKey =
    baseName
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8) || "IMP";

  if (filename.toLowerCase().endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as
      | SyncPreviewData
      | { project_name?: string; project_key?: string; name?: string; issues?: Record<string, unknown>[] }
      | Record<string, unknown>[];

    const rawIssues: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.issues)
        ? (parsed.issues as Record<string, unknown>[])
        : [];

    if (!rawIssues.length) {
      throw new Error("No issues found in JSON file.");
    }

    const issues: SyncIssueItem[] = rawIssues.map((item, idx) => {
      const labelsRaw = item.labels;
      const labels = Array.isArray(labelsRaw)
        ? labelsRaw.map((l) => (typeof l === "string" ? l : String((l as { name?: string })?.name ?? ""))).filter(Boolean)
        : typeof labelsRaw === "string"
          ? labelsRaw.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
          : [];
      return {
        external_id: String(item.external_id ?? item.identifier ?? item.key ?? `IMP-${idx + 1}`),
        title: String(item.title ?? item.summary ?? "Untitled issue"),
        description: item.description ? String(item.description) : null,
        issue_type: normalizeType(String(item.issue_type ?? item.type ?? "task")),
        priority: normalizePriority(String(item.priority ?? "medium")),
        status: String(item.status ?? item.status_name ?? "Todo"),
        labels,
      };
    });

    const statuses = Array.from(new Set(issues.map((i) => i.status)));
    const meta = Array.isArray(parsed) ? {} : parsed;
    return {
      provider: "json",
      project_name: String(meta.project_name ?? (meta as { name?: string }).name ?? baseName),
      project_key: String(meta.project_key ?? defaultKey),
      statuses,
      issues,
    };
  }

  const rows = parseCsvRows(trimmed);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one issue row.");
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => headers.findIndex((h) => names.includes(h));
  const titleIdx = col("title", "summary", "issue title", "name");
  if (titleIdx === -1) {
    throw new Error("CSV header must include a 'title' or 'summary' column.");
  }
  const keyIdx = col("key", "issue key", "identifier", "id", "external_id");
  const descIdx = col("description", "body", "details");
  const typeIdx = col("type", "issue type", "issuetype", "issue_type");
  const prioIdx = col("priority");
  const statusIdx = col("status", "state", "column");
  const labelsIdx = col("labels", "tags");

  const issues: SyncIssueItem[] = rows.slice(1).map((r, idx) => ({
    external_id: keyIdx >= 0 && r[keyIdx] ? r[keyIdx].trim() : `CSV-${idx + 1}`,
    title: r[titleIdx]?.trim() || "Untitled issue",
    description: descIdx >= 0 && r[descIdx] ? r[descIdx] : null,
    issue_type: normalizeType(typeIdx >= 0 ? r[typeIdx] : undefined),
    priority: normalizePriority(prioIdx >= 0 ? r[prioIdx] : undefined),
    status: (statusIdx >= 0 && r[statusIdx]?.trim()) || "Todo",
    labels:
      labelsIdx >= 0 && r[labelsIdx]
        ? r[labelsIdx].split(/[;|]/).map((s) => s.trim()).filter(Boolean)
        : [],
  }));

  return {
    provider: "csv",
    project_name: baseName,
    project_key: defaultKey,
    statuses: Array.from(new Set(issues.map((i) => i.status))),
    issues,
  };
}

export function issuesToCsv(
  issues: {
    identifier: string;
    title: string;
    description?: string | null;
    type: string;
    priority: string;
    status_name: string;
    labels?: { name: string }[];
  }[],
): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    ["identifier", "title", "description", "type", "priority", "status", "labels"].join(","),
    ...issues.map((i) =>
      [
        esc(i.identifier),
        esc(i.title),
        esc(i.description ?? ""),
        esc(i.type),
        esc(i.priority),
        esc(i.status_name),
        esc((i.labels ?? []).map((l) => l.name).join("; ")),
      ].join(","),
    ),
  ];
  return lines.join("\n");
}
