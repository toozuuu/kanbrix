import {useTranslation} from "react-i18next";
import { useCalendar } from "./PersonalSettings";
import { useState,lazy,Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Issue } from "../types";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { LabelBadge } from "../components/ui/LabelBadge";
import { formatRelativeTime, getPriorityColor, getTypeBadge } from "../lib/utils";
import {
  Kanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";

const Reports=lazy(()=>import("../components/Reports"));
interface DashboardPageProps {
  onOpenCreateIssue: () => void;
  onSelectIssue: (issue: Issue) => void;
}

export function DashboardPage({ onOpenCreateIssue, onSelectIssue }: DashboardPageProps) {
  const {t}=useTranslation();
  const { currentWorkspace, currentProject } = useWorkspace();
  const { user } = useAuth();
  const projectId = currentProject?.id;
  const workspaceId = currentWorkspace?.id;
  const [onlyMine, setOnlyMine] = useState(false);
  const calendar=useCalendar();
  const today=calendar.day();
  const cutoff = format(addDays(new Date(today+"T12:00:00"), 7), "yyyy-MM-dd") + "T00:00:00Z";
  const issueQuery = useQuery({
    refetchOnMount: "always",
    queryKey: ["dashboard-issues", user?.id, projectId, cutoff, onlyMine],
    enabled: !!projectId && !!user,
    queryFn: async () => {
      const [counts, assignedToMe, deadlines] = await Promise.all([
        api.issues.counts(projectId!),
        api.issues.list(projectId!, { assignee_id: user!.id, limit: 20 }),
        api.issues.list(projectId!, { due_before: cutoff, assignee_id: onlyMine ? user!.id : undefined, limit: 20 }),
      ]);
      return { ...counts, assignedToMe, deadlines };
    },
  });
  const activityQuery = useQuery({
    queryKey: ["workspace-activity", user?.id, workspaceId],
    queryFn: () => api.workspaces.activity(workspaceId!),
    enabled: !!workspaceId,
  });
  const activities = activityQuery.data ?? [];
  const { total = 0, assigned = 0, in_progress: inProgress = 0, completed = 0,
    assignedToMe = [], deadlines = [] } = issueQuery.data ?? {};

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-card to-card border border-border/60">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome back, {user?.name.split(" ")[0]}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Here is what's happening across your active workspace and projects today.
          </p>
        </div>
        <Button onClick={onOpenCreateIssue} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          <span>{t("New Issue")}</span>
        </Button>
      </div>

      {issueQuery.isFetching && !issueQuery.data && <p role="status">Loading project issues…</p>}
      {issueQuery.isError && <button className="text-primary underline" onClick={() => issueQuery.refetch()}>Could not load project issues. Retry</button>}
      {issueQuery.data && <>
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">{t("Total Issues")}</span>
            <Kanban className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{total}</div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Assigned to Me</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{assigned}</div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">{t("In Progress")}</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{inProgress}</div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">{t("Completed")}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{completed}</div>
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute left-0 top-0 h-full bg-primary transition-all duration-300"
                  style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{total ? Math.round(completed * 100 / total) : 0}% complete</p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Project deadlines</h2>
            <p className="text-xs text-muted-foreground">First 20 open issues overdue or due in the next seven days</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />Only my issues</label>
        </div>
        {deadlines.length ? <ul className="max-h-64 divide-y divide-border overflow-y-auto">{deadlines.map(issue => {
          const date = issue.due_date!.slice(0, 10);
          return <li key={issue.id}><button onClick={() => onSelectIssue(issue)} className="flex w-full items-center gap-3 rounded px-2 py-3 text-left text-sm hover:bg-secondary">
            <span className="font-mono text-xs text-muted-foreground">{issue.identifier}</span>
            <span className="min-w-0 flex-1 truncate">{issue.title}</span>
            <time dateTime={date} className={date < today ? "text-destructive" : "text-muted-foreground"}>{date < today ? "Overdue · " : ""}{date === today ? "Today" : date}</time>
          </button></li>;
        })}</ul> : <p className="text-sm text-muted-foreground">No open issues due in this period.</p>}
      </section>
      </>}
      {projectId && <Suspense fallback={<p>Loading reports…</p>}><Reports key={projectId} project={projectId}/></Suspense>}
      {/* Content Grid: Assigned Issues & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Issues */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{t("Assigned to You")}</h2>
              <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                {assigned}
              </span>
            </div>
            <Link
              to="/kanban?assignment=mine"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span>View board</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {assignedToMe.map((issue) => {
              const priorityStyle = getPriorityColor(issue.priority);
              const typeBadge = getTypeBadge(issue.type);

              return (
                <div
                  key={issue.id}
                  onClick={() => onSelectIssue(issue)}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-secondary/20 hover:border-primary/40 transition-colors cursor-pointer text-xs"
                >
                  <div className="flex flex-col gap-1 truncate">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${typeBadge.color}`}>
                        {typeBadge.label}
                      </span>
                      <span className="font-mono font-semibold text-primary">{issue.identifier}</span>
                      <span className="font-medium text-foreground truncate">{issue.title}</span>
                    </div>
                    {issue.labels.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap opacity-70">
                        {issue.labels.map(label => (
                          <LabelBadge key={label.id} label={label} />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase ${priorityStyle}`}>
                    {issue.priority}
                  </span>
                </div>
              );
            })}

            {issueQuery.isSuccess && assignedToMe.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground/60 italic">
                No issues currently assigned to you!
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Workspace Activity</h2>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {activities.map((act) => (
              <div key={act.id} className="flex items-start gap-2.5 text-xs">
                <Avatar name={act.actor_name || "System"} size="sm" className="mt-0.5 shrink-0" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-foreground leading-snug">
                    <span className="font-semibold">{act.actor_name || "User"}</span>{" "}
                    <span className="text-muted-foreground">{act.action}</span>{" "}
                    <span className="font-medium text-foreground">
                      {act.metadata?.title || act.entity_type}
                    </span>
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    {formatRelativeTime(act.created_at)}
                  </span>
                </div>
              </div>
            ))}

            {activityQuery.isLoading && <p role="status">Loading activity…</p>}
            {activityQuery.isError && <button onClick={() => activityQuery.refetch()} className="text-primary underline">Could not load activity. Retry</button>}
            {activityQuery.isSuccess && activities.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground/60 italic">
                No recent activity recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
