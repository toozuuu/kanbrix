import { ProjectEmptyState } from "../components/ui/ProjectEmptyState";
import { useTranslation } from "react-i18next";
import { useCalendar } from "./PersonalSettings";
import { useState, lazy, Suspense } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Issue } from "../types";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { LabelBadge } from "../components/ui/LabelBadge";
import { ProjectSpinner } from "../components/ui/ProjectSpinner";
import { useToast } from "../components/ui/Toast";
import { formatRelativeTime, getPriorityColor, getTypeBadge } from "../lib/utils";
import {
  Kanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  ArrowRight,
  CalendarClock,
  Plus,
  UserCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

const WorkloadChart = lazy(() => import("../components/WorkloadChart"));
const Reports = lazy(() => import("../components/Reports"));

interface DashboardPageProps {
  onOpenCreateIssue: () => void;
  onSelectIssue: (issue: Issue) => void;
}

export function DashboardPage({ onOpenCreateIssue, onSelectIssue }: DashboardPageProps) {
  const { t } = useTranslation();
  const { currentWorkspace, currentProject } = useWorkspace();
  const { user } = useAuth();
  const projectId = currentProject?.id;
  const workspaceId = currentWorkspace?.id;
  const [onlyMine, setOnlyMine] = useState(false);
  const today = useCalendar().day();
  const { toast } = useToast();
  const openIssue = useMutation({ mutationFn: api.issues.get });

  const issueQuery = useQuery({
    refetchOnMount: "always",
    queryKey: ["dashboard-issues", user?.id, projectId],
    enabled: !!projectId && !!user,
    queryFn: async () => {
      const [counts, assignedToMe] = await Promise.all([
        api.issues.counts(projectId!),
        api.issues.list(projectId!, { assignee_id: user!.id, limit: 20 }),
      ]);
      return { ...counts, assignedToMe };
    },
  });

  const deadlineQuery = useQuery({
    queryKey: ["dashboard-issues", "deadlines", user?.id, projectId, today, onlyMine],
    enabled: !!projectId && !!user,
    queryFn: () => api.issues.deadlines(projectId!, today, onlyMine),
  });

  const activityQuery = useQuery({
    queryKey: ["workspace-activity", user?.id, workspaceId],
    queryFn: () => api.workspaces.activity(workspaceId!),
    enabled: !!workspaceId,
  });

  const activities = activityQuery.data ?? [];
  const {
    total = 0,
    assigned = 0,
    in_progress: inProgress = 0,
    completed = 0,
    assignedToMe = [],
  } = issueQuery.data ?? {};

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const completionPct = total ? Math.round((completed * 100) / total) : 0;
  const { items: deadlines = [], overdue_count: overdueCount = 0 } = deadlineQuery.data ?? {};

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <section className="rounded-2xl border border-border/70 bg-gradient-to-r from-primary/10 via-card to-card p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {currentWorkspace && (
                <span className="font-medium text-foreground/80">
                  {currentWorkspace.name}
                </span>
              )}
              {currentWorkspace && currentProject && (
                <span aria-hidden="true">/</span>
              )}
              {currentProject && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2 py-0.5 font-medium text-foreground">
                  <span>{currentProject.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {currentProject.project_key}
                  </span>
                </span>
              )}
            </div>
            <h1 className="page-heading">
              {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Track sprint progress, upcoming deadlines, and issues assigned to you.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentProject && (
              <Link
                to="/kanban"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--button-radius)] border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Kanban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span>Open Board</span>
              </Link>
            )}
            <Button onClick={onOpenCreateIssue} size="sm" className="gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{t("New Issue")}</span>
            </Button>
          </div>
        </div>
      </section>

      {!currentProject && <ProjectEmptyState />}

      {issueQuery.isFetching && !issueQuery.data && (
        <ProjectSpinner
          message="Loading project issues…"
          subMessage={currentProject ? `Project: ${currentProject.name}` : undefined}
        />
      )}

      {issueQuery.isError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          Could not load project issues.{" "}
          <button
            type="button"
            className="font-medium text-primary underline"
            onClick={() => void issueQuery.refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {issueQuery.data && (
        <>
          {/* KPI Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("Total Issues")}
                </span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Kanban className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">
                {total}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Active issues in project
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned to Me
                </span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">
                {assigned}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Issues awaiting your action
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("In Progress")}
                </span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">
                {inProgress}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Currently being worked on
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("Completed")}
                </span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {completed}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {completionPct}%
                </span>
              </div>
              <div
                className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Completion progress"
                aria-valuenow={completionPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          </div>

          <Suspense fallback={<ProjectSpinner size="sm" message="Loading workload chart." />}><WorkloadChart key={projectId} project={projectId!} onSelectIssue={onSelectIssue} rows={issueQuery.data?.workload} /></Suspense>
          {/* Priority Focus Grid: Assigned Issues & Upcoming Deadlines */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assigned to You */}
            <section className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("Assigned to You")}
                  </h2>
                  <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full tabular-nums">
                    {assigned}
                  </span>
                </div>
                <Link
                  to="/kanban?assignment=mine"
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <span>View board</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {assignedToMe.map((issue) => {
                  const priorityStyle = getPriorityColor(issue.priority);
                  const typeBadge = getTypeBadge(issue.type);

                  return (
                    <button
                      type="button"
                      key={issue.id}
                      onClick={() => onSelectIssue(issue)}
                      className="flex w-full items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-secondary/20 hover:border-primary/40 hover:bg-secondary/40 transition-colors text-left text-xs"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`shrink-0 px-1.5 py-0.5 rounded border text-xs font-semibold ${typeBadge.color}`}>
                            {typeBadge.label}
                          </span>
                          <span className="shrink-0 font-mono font-semibold text-primary">
                            {issue.identifier}
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {issue.title}
                          </span>
                        </div>
                        {!!issue.labels?.length && (
                          <div className="flex items-center gap-1 flex-wrap opacity-80">
                            {issue.labels.map((label) => (
                              <LabelBadge key={label.id} label={label} />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded border text-xs font-medium uppercase ${priorityStyle}`}>
                        {issue.priority}
                      </span>
                    </button>
                  );
                })}

                {issueQuery.isSuccess && assignedToMe.length === 0 && (
                  <div className="py-10 text-center text-xs text-muted-foreground">
                    No issues currently assigned to you.
                  </div>
                )}
              </div>
            </section>

            {/* Project Deadlines */}
            <section className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">
                        Project deadlines
                      </h2>
                      {overdueCount > 0 && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive tabular-nums">
                          {overdueCount} overdue
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Open issues overdue or due in the next 7 days
                    </p>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyMine}
                    onChange={(e) => setOnlyMine(e.target.checked)}
                  />
                  <span>Only my issues</span>
                </label>
              </div>

              {deadlineQuery.isPending && <ProjectSpinner size="sm" message="Loading deadlines." />}
              {deadlineQuery.isError && (
                <p role="alert" className="text-sm">Could not load deadlines.{" "}
                  <button type="button" className="text-primary underline" onClick={() => void deadlineQuery.refetch()}>Retry</button>
                </p>
              )}
              {deadlines.length > 0 && (
                <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto pr-1">
                  {deadlines.map((issue) => {
                    const date = issue.due_date!.slice(0, 10);
                    const isOverdue = date < today;
                    const isToday = date === today;
                    return (
                      <li key={issue.id}>
                        <button
                          type="button"
                          onClick={() => openIssue.mutate(issue.id, {
                            onSuccess: selected => onSelectIssue(selected),
                            onError: () => toast("Could not open the issue.", "error"),
                          })}
                          disabled={openIssue.isPending && openIssue.variables === issue.id}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm hover:bg-secondary/50 transition-colors"
                        >
                          <span className="shrink-0 font-mono text-xs font-semibold text-primary">
                            {issue.identifier}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-foreground">
                            {issue.title}
                          </span>
                          <time
                            dateTime={date}
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                              isOverdue
                                ? "bg-destructive/10 text-destructive"
                                : isToday
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {isOverdue ? `Overdue · ${date}` : isToday ? "Today" : date}
                          </time>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {deadlineQuery.isSuccess && deadlines.length === 0 && (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No open issues due in this period.
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {projectId && (
        <Suspense fallback={<ProjectSpinner size="sm" message="Loading reports." />}>
          <Reports key={projectId} project={projectId} />
        </Suspense>
      )}

      {/* Workspace Activity Feed */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Workspace Activity</h2>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {activities.map((act) => (
            <div key={act.id} className="flex items-start gap-3 text-xs py-1">
              <Avatar name={act.actor_name || "System"} size="sm" className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-foreground leading-snug">
                  <span className="font-semibold">{act.actor_name || "User"}</span>{" "}
                  <span className="text-muted-foreground">{act.action}</span>{" "}
                  <span className="font-medium text-foreground">
                    {act.metadata?.title || act.entity_type}
                  </span>
                </p>
                <span className="text-xs text-muted-foreground block">
                  {formatRelativeTime(act.created_at)}
                </span>
              </div>
            </div>
          ))}

          {workspaceId && activityQuery.isPending && (
            <ProjectSpinner size="sm" message="Loading activity." />
          )}
          {activityQuery.isError && (
            <button
              type="button"
              onClick={() => void activityQuery.refetch()}
              className="text-xs text-primary underline"
            >
              Could not load activity. Retry
            </button>
          )}
          {activityQuery.isSuccess && activities.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No recent activity recorded.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
