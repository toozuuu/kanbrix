import { useState } from "react";
import { Sparkles } from "lucide-react";

export type TemplateGroup = "All" | "Engineering" | "IT & Ops" | "Product";

export interface BuiltinTemplate {
  name: string;
  group: Exclude<TemplateGroup, "All">;
  badge?: string;
  description: string;
  category: string;
  accent: string;
  artwork:
    | "prioritization"
    | "requests"
    | "kanban"
    | "scrum"
    | "planning"
    | "process"
    | "servicedesk"
    | "incident"
    | "change"
    | "devops"
    | "security"
    | "bugs"
    | "cloud"
    | "release";
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    name: "Kanban",
    group: "Engineering",
    description:
      "Work efficiently and visualize continuous flow on a board with to do, doing, and done.",
    category: "Engineering",
    accent: "#3b82f6",
    artwork: "kanban",
  },
  {
    name: "Scrum",
    group: "Engineering",
    description:
      "Plan, track, and execute work using time-boxed sprints, story points, and a prioritized backlog.",
    category: "Engineering",
    accent: "#2563eb",
    artwork: "scrum",
  },
  {
    name: "IT Service Desk",
    group: "IT & Ops",
    badge: "ITSM",
    description:
      "Handle employee IT tickets, hardware requests, and access issues with clear triage and SLA states.",
    category: "IT Service Management",
    accent: "#0ea5e9",
    artwork: "servicedesk",
  },
  {
    name: "Incident Management",
    group: "IT & Ops",
    badge: "On-Call",
    description:
      "Respond rapidly to outages from detection and mitigation through root-cause postmortems.",
    category: "IT Operations",
    accent: "#ef4444",
    artwork: "incident",
  },
  {
    name: "Change Management",
    group: "IT & Ops",
    badge: "ITIL",
    description:
      "Coordinate production changes with CAB review, scheduled maintenance windows, and validation.",
    category: "IT Governance",
    accent: "#f59e0b",
    artwork: "change",
  },
  {
    name: "DevOps & CI/CD",
    group: "Engineering",
    description:
      "Track infrastructure automation, build pipelines, staging QA, and production deployments.",
    category: "DevOps",
    accent: "#6366f1",
    artwork: "devops",
  },
  {
    name: "Security & Compliance",
    group: "IT & Ops",
    badge: "SecOps",
    description:
      "Manage vulnerability remediation, access audits, and compliance controls from report to fix.",
    category: "Security",
    accent: "#10b981",
    artwork: "security",
  },
  {
    name: "Bug Tracking",
    group: "Engineering",
    description:
      "Capture, reproduce, fix, and QA-verify software defects across sprints and releases.",
    category: "Quality Assurance",
    accent: "#ec4899",
    artwork: "bugs",
  },
  {
    name: "Infrastructure & Cloud",
    group: "IT & Ops",
    description:
      "Plan cloud provisioning, network upgrades, and server migrations with audit checkpoints.",
    category: "Cloud Ops",
    accent: "#06b6d4",
    artwork: "cloud",
  },
  {
    name: "Release Management",
    group: "Engineering",
    description:
      "Coordinate code freezes, QA sign-offs, canary rollouts, and production releases.",
    category: "Release Ops",
    accent: "#8b5cf6",
    artwork: "release",
  },
  {
    name: "Development requests",
    group: "IT & Ops",
    badge: "Service",
    description:
      "Easily sync new feature requests, bugs, and incidents directly with your engineering backlog.",
    category: "Service Management",
    accent: "#eab308",
    artwork: "requests",
  },
  {
    name: "Prioritization",
    group: "Product",
    badge: "Discovery",
    description:
      "Evaluate ideas across reach, impact, confidence, and effort to quickly prioritize your roadmap.",
    category: "Product Discovery",
    accent: "#65a30d",
    artwork: "prioritization",
  },
  {
    name: "Cross-team planning",
    group: "Product",
    badge: "Timeline",
    description:
      "Align engineering and product teams on shared goals, milestones, and delivery timelines.",
    category: "Product",
    accent: "#8b5cf6",
    artwork: "planning",
  },
  {
    name: "Process control",
    group: "IT & Ops",
    description:
      "Track, review, and improve recurring operational workflows with structured QA checkpoints.",
    category: "Operations",
    accent: "#0d9488",
    artwork: "process",
  },
];

function TemplateArtwork({ kind, accent }: { kind: BuiltinTemplate["artwork"]; accent: string }) {
  return (
    <div className="h-28 w-full rounded-xl bg-secondary/45 border border-border/50 flex items-center justify-center overflow-hidden p-3">
      {kind === "prioritization" && (
        <svg viewBox="0 0 200 96" className="h-full w-full" aria-hidden="true">
          <rect x="22" y="10" width="156" height="76" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          <rect x="34" y="22" width="132" height="14" rx="4" fill={accent} opacity="0.25" />
          <rect x="30" y="38" width="140" height="20" rx="5" fill={accent} />
          <circle cx="44" cy="48" r="4" fill="#fff" />
          <rect x="34" y="64" width="132" height="12" rx="4" fill="hsl(var(--muted))" />
        </svg>
      )}
      {(kind === "requests" || kind === "servicedesk") && (
        <svg viewBox="0 0 200 96" className="h-full w-full" aria-hidden="true">
          <circle cx="56" cy="24" r="9" fill={accent} />
          <circle cx="56" cy="50" r="9" fill="#22c55e" />
          <circle cx="56" cy="74" r="9" fill="hsl(var(--muted-foreground))" opacity="0.35" />
          <path d="M65 24 C95 24, 95 44, 118 44" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2" />
          <rect x="116" y="30" width="60" height="44" rx="6" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          <rect x="124" y="40" width="42" height="6" rx="3" fill={accent} opacity="0.85" />
          <rect x="124" y="52" width="32" height="6" rx="3" fill="hsl(var(--muted))" />
        </svg>
      )}
      {(kind === "kanban" || kind === "bugs" || kind === "change") && (
        <svg viewBox="0 0 200 96" className="h-full w-full" aria-hidden="true">
          <rect x="26" y="10" width="44" height="76" rx="6" fill="hsl(var(--muted))" />
          <rect x="78" y="10" width="44" height="76" rx="6" fill="hsl(var(--muted))" />
          <rect x="130" y="10" width="44" height="76" rx="6" fill="hsl(var(--muted))" />
          <rect x="31" y="16" width="34" height="18" rx="3" fill="hsl(var(--card))" />
          <rect x="83" y="16" width="34" height="18" rx="3" fill="hsl(var(--card))" />
          <rect x="96" y="40" width="62" height="34" rx="5" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          <rect x="132" y="60" width="18" height="6" rx="3" fill={accent} />
        </svg>
      )}
      {(kind === "scrum" || kind === "devops" || kind === "release") && (
        <svg viewBox="0 0 200 96" className="h-full w-full" aria-hidden="true">
          <rect x="26" y="12" width="148" height="18" rx="4" fill="hsl(var(--muted))" />
          <rect x="26" y="34" width="148" height="18" rx="4" fill="hsl(var(--muted))" />
          <rect x="38" y="28" width="124" height="22" rx="5" fill={accent} />
          <rect x="46" y="36" width="54" height="5" rx="2.5" fill="#fff" />
          <rect x="26" y="56" width="148" height="14" rx="4" fill="hsl(var(--muted))" opacity="0.7" />
          <rect x="26" y="74" width="148" height="12" rx="4" fill="hsl(var(--muted))" opacity="0.5" />
        </svg>
      )}
      {(kind === "planning" || kind === "cloud") && (
        <svg viewBox="0 0 200 96" className="h-full w-full" aria-hidden="true">
          <rect x="24" y="12" width="152" height="72" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          <rect x="36" y="28" width="46" height="10" rx="5" fill="#84cc16" />
          <rect x="92" y="28" width="44" height="10" rx="5" fill={accent} />
          <rect x="44" y="44" width="82" height="10" rx="5" fill="#f59e0b" />
          <rect x="64" y="60" width="76" height="10" rx="5" fill="#a855f7" />
          <line x1="108" y1="20" x2="108" y2="78" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
        </svg>
      )}
      {(kind === "process" || kind === "incident" || kind === "security") && (
        <svg viewBox="0 0 200 96" className="h-full w-full" aria-hidden="true">
          <rect x="26" y="10" width="44" height="76" rx="6" fill="hsl(var(--muted))" />
          <rect x="78" y="10" width="44" height="76" rx="6" fill="hsl(var(--muted))" />
          <rect x="130" y="10" width="44" height="76" rx="6" fill="hsl(var(--muted))" />
          <rect x="34" y="26" width="42" height="24" rx="4" fill={accent} />
          <rect x="96" y="34" width="54" height="28" rx="5" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          <circle cx="88" cy="46" r="9" fill="hsl(var(--foreground))" />
        </svg>
      )}
    </div>
  );
}

const GROUPS: TemplateGroup[] = ["All", "Engineering", "IT & Ops", "Product"];

export function ProjectTemplateGallery({
  onSelectTemplate,
}: {
  onSelectTemplate: (templateName: string) => void;
}) {
  const [group, setGroup] = useState<TemplateGroup>("All");
  const visible =
    group === "All"
      ? BUILTIN_TEMPLATES
      : BUILTIN_TEMPLATES.filter((t) => t.group === group);

  return (
    <section className="space-y-4 pt-2" aria-labelledby="made-for-you-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="made-for-you-heading" className="text-lg font-semibold tracking-tight text-foreground">
            Made for you
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Templates for you based on how engineering, IT, and operations teams work.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter templates by category">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground transition-colors"
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visible.map((tpl) => (
          <button
            key={tpl.name}
            type="button"
            onClick={() => onSelectTemplate(tpl.name)}
            className="group flex flex-col text-left rounded-2xl border border-border/75 bg-card p-4 shadow-[var(--shadow-sm)] hover:border-primary/45 hover:shadow-[var(--shadow-md)] transition-all"
          >
            <TemplateArtwork kind={tpl.artwork} accent={tpl.accent} />
            <div className="mt-3.5 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {tpl.name}
              </h3>
              {tpl.badge && (
                <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                  {tpl.badge}
                </span>
              )}
            </div>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
              {tpl.description}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>{tpl.category}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
