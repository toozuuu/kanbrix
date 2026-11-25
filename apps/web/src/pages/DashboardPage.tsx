import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, ArrowRight, CalendarClock, CheckCircle2, Clock, Kanban, Plus, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { api } from "../lib/api";
import { formatRelativeTime, getTypeBadge } from "../lib/utils";
import type { Issue } from "../types";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { LabelBadge } from "../components/ui/LabelBadge";
import { ProjectEmptyState } from "../components/ui/ProjectEmptyState";
import { ProjectSpinner } from "../components/ui/ProjectSpinner";
import { useToast } from "../components/ui/Toast";
import { useCalendar } from "./PersonalSettings";

const WorkloadChart = lazy(() => import("../components/WorkloadChart"));
const Reports = lazy(() => import("../components/Reports"));

interface DashboardPageProps {
  onOpenCreateIssue: () => void;
  onSelectIssue: (issue: Issue) => void;
}

const panel = "min-w-0 overflow-hidden rounded-xl border border-border bg-card";
const panelHeader = "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/75 px-4 py-4 sm:px-5";
const panelTitle = "flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight";
const issueRow = "flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-offset-[-3px] sm:px-5";
const panelEmpty = "px-4 py-8 text-sm text-muted-foreground sm:px-5";
const priorityTones: Record<string, string> = {
  urgent: "border-destructive/30 bg-destructive/10 text-destructive",
  high: "border-warning/30 bg-warning/10 text-warning",
};

export function DashboardPage({ onOpenCreateIssue, onSelectIssue }: DashboardPageProps) {
  const { t } = useTranslation();
  const { currentWorkspace, currentProject } = useWorkspace();
  const { user } = useAuth();
  const projectId = currentProject?.id;
  const workspaceId = currentWorkspace?.id;
  const userId = user?.id;
  const [onlyMine, setOnlyMine] = useState(false);
  const today = useCalendar().day();
  const { toast } = useToast();
  const openIssue = useMutation({ mutationFn: api.issues.get });

  const issueQuery = useQuery({
    refetchOnMount: "always",
    queryKey: ["dashboard-issues", userId, projectId],
    enabled: !!projectId && !!userId,
    queryFn: async () => {
      const [counts, assignedToMe] = await Promise.all([
        api.issues.counts(projectId!),
        api.issues.list(projectId!, { assignee_id: userId, limit: 20 }),
      ]);
      return { ...counts, assignedToMe };
    },
  });

  const deadlineQuery = useQuery({
    refetchOnMount: "always",
    queryKey: ["dashboard-issues", "deadlines", userId, projectId, today, onlyMine],
    enabled: !!projectId && !!userId,
    queryFn: () => api.issues.deadlines(projectId!, today, onlyMine),
  });

  const activityQuery = useQuery({
    queryKey: ["workspace-activity", userId, workspaceId],
    queryFn: () => api.workspaces.activity(workspaceId!),
    enabled: !!workspaceId,
  });

  const { total = 0, assigned = 0, in_progress: inProgress = 0, completed = 0, assignedToMe = [] } =
    issueQuery.data ?? {};
  const completionPct = total ? Math.round((completed * 100) / total) : 0;
  const { items: deadlines = [], overdue_count: overdueCount = 0 } = deadlineQuery.data ?? {};
  const metrics = [
    { label: t("Total Issues"), value: total, icon: Kanban },
    { label: t("Assigned to You"), value: assigned, icon: UserCheck },
    { label: t("In Progress"), value: inProgress, icon: Clock },
    { label: t("Completed"), value: completed, icon: CheckCircle2 },
  ];

  return (
    <div className="project-dashboard mx-auto max-w-[96rem] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          {currentProject && currentWorkspace && (
            <p className="mb-1 break-words text-sm text-muted-foreground">{currentWorkspace.name}</p>
          )}
          <h1 className="break-words font-serif text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
            {currentProject?.name ?? t("Dashboard")}
          </h1>
        </div>
        {currentProject && (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/kanban"
              className="inline-flex h-9 items-center gap-2 rounded-[var(--button-radius)] border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Kanban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Open Board
            </Link>
            <Button onClick={onOpenCreateIssue} size="sm" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("New Issue")}
            </Button>
          </div>
        )}
      </header>

      {!currentProject && <ProjectEmptyState />}

      {projectId && (
        <>
          {issueQuery.isPending && <ProjectSpinner size="sm" message="Loading project issues…" />}
          {issueQuery.isError && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              Could not load project issues.{" "}
              <button type="button" className="font-medium text-primary underline" onClick={() => void issueQuery.refetch()}>
                Retry
              </button>
            </div>
          )}
          {issueQuery.data && (
            <dl aria-label="Project overview" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
              {metrics.map(({ label, value, icon: Icon }, index) => (
                <div className="min-w-0 bg-card p-3 sm:p-4 lg:px-5" key={label}>
                  <dt className="flex items-start gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{label}</span>
                  </dt>
                  <dd className="mt-2 text-3xl font-semibold leading-none tracking-tight tabular-nums">{value}</dd>
                  {index === metrics.length - 1 && (
                    <dd className="mt-2.5 flex items-center gap-2">
                      <div
                        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label="Completion progress"
                        aria-valuenow={completionPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className="h-full rounded-full bg-primary" style={{ width: completionPct + "%" }} />
                      </div>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">{completionPct}%</span>
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          )}

          <div className="dashboard-columns grid gap-5">
            <section className={panel} aria-labelledby="dashboard-assigned">
              <div className={panelHeader}>
                <h2 id="dashboard-assigned" className={panelTitle}>
                  <UserCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {t("Assigned to You")}
                </h2>
                <Link to="/kanban?assignment=mine" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  View board <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              {assignedToMe.length > 0 ? (
                <ul className="max-h-80 divide-y divide-border/75 overflow-y-auto">
                  {assignedToMe.map(issue => {
                    const typeBadge = getTypeBadge(issue.type);
                    return (
                      <li key={issue.id}>
                        <button type="button" onClick={() => onSelectIssue(issue)} className={issueRow}>
                          <span className="min-w-0">
                            <span className="block break-words text-sm font-medium">{issue.title}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span className="font-mono">{issue.identifier}</span>
                              <span>{typeBadge.label}</span>
                              {issue.labels?.map(label => <LabelBadge key={label.id} label={label} className="max-w-full break-all" />)}
                            </span>
                          </span>
                          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${priorityTones[issue.priority.toLowerCase()] ?? "border-border bg-muted text-muted-foreground"}`}>
                            {issue.priority}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : issueQuery.isSuccess && <p className={panelEmpty}>No issues currently assigned to you.</p>}
            </section>

            <section className={panel} aria-labelledby="dashboard-deadlines">
              <div className={panelHeader}>
                <div>
                  <h2 id="dashboard-deadlines" className={panelTitle}>
                    <CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    Project deadlines
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>Next 7 days</span>
                    {overdueCount > 0 && <span className="font-medium text-destructive">{overdueCount} overdue</span>}
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                  <input type="checkbox" className="accent-primary" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
                  Only my issues
                </label>
              </div>
              {deadlineQuery.isPending && <ProjectSpinner size="sm" message="Loading deadlines." className="p-4" />}
              {deadlineQuery.isError && (
                <p role="alert" className={panelEmpty}>
                  Could not load deadlines.{" "}
                  <button type="button" className="text-primary underline" onClick={() => void deadlineQuery.refetch()}>Retry</button>
                </p>
              )}
              {deadlines.length > 0 ? (
                <ul className="max-h-80 divide-y divide-border/75 overflow-y-auto">
                  {deadlines.map(issue => {
                    const date = issue.due_date!.slice(0, 10);
                    return <li key={issue.id}>
                      <button type="button"
                        onClick={() => openIssue.mutate(issue.id, {
                          onSuccess: selected => onSelectIssue(selected),
                          onError: () => toast("Could not open the issue.", "error"),
                        })}
                        disabled={openIssue.isPending && openIssue.variables === issue.id}
                        className={issueRow}>
                        <span className="min-w-0">
                          <span className="block break-words text-sm font-medium">{issue.title}</span>
                          <span className="mt-1 block font-mono text-xs text-muted-foreground">{issue.identifier}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs">
                          <time dateTime={date} className="block font-medium tabular-nums">
                            {format(new Date(date + "T12:00:00"), "MMM d")}
                          </time>
                          {date <= today && (
                            <span className={date < today ? "text-destructive" : "text-warning"}>
                              {date < today ? "Overdue" : "Today"}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  })}
                </ul>
              ) : deadlineQuery.isSuccess && <p className={panelEmpty}>No open issues due in this period.</p>}
            </section>
          </div>

          <div className="dashboard-columns grid items-start gap-5">
            <Suspense fallback={<ProjectSpinner size="sm" message="Loading reports." />}>
              <Reports key={projectId} project={projectId} />
            </Suspense>
            <Suspense fallback={<ProjectSpinner size="sm" message="Loading workload chart." />}>
              {issueQuery.data && <WorkloadChart key={projectId} project={projectId} onSelectIssue={onSelectIssue} rows={issueQuery.data.workload} />}
            </Suspense>
          </div>
        </>
      )}

      {workspaceId && (
        <section className={panel} aria-labelledby="dashboard-activity">
          <div className={panelHeader}>
            <h2 id="dashboard-activity" className={panelTitle}>
              <Activity className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Workspace Activity
            </h2>
          </div>
          <ul className="max-h-72 divide-y divide-border/75 overflow-y-auto">
            {activityQuery.data?.map(entry => (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                <Avatar name={entry.actor_name || "System"} size="sm" className="shrink-0" />
                <p className="min-w-0 flex-1 break-words">
                  <span className="font-medium">{entry.actor_name || "User"}</span>{" "}
                  <span className="text-muted-foreground">{entry.action}</span>{" "}
                  {entry.metadata?.title || entry.entity_type}
                </p>
                <time dateTime={entry.created_at} className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(entry.created_at)}
                </time>
              </li>
            ))}
          </ul>
          {activityQuery.isPending && <ProjectSpinner size="sm" message="Loading activity." className="p-4" />}
          {activityQuery.isError && (
            <p role="alert" className={panelEmpty}>
              Could not load activity.{" "}
              <button type="button" className="text-primary underline" onClick={() => void activityQuery.refetch()}>Retry</button>
            </p>
          )}
          {activityQuery.isSuccess && activityQuery.data.length === 0 && <p className={panelEmpty}>No recent activity recorded.</p>}
        </section>
      )}
    </div>
  );
}
