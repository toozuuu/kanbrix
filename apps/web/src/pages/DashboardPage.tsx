import { useEffect, useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { ActivityLog, Issue } from "../types";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
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

interface DashboardPageProps {
  onOpenCreateIssue: () => void;
  onSelectIssue: (issue: Issue) => void;
}

export function DashboardPage({ onOpenCreateIssue, onSelectIssue }: DashboardPageProps) {
  const { currentWorkspace, currentProject } = useWorkspace();
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!currentWorkspace) return;
      try {
        if (currentProject) {
          const issueList = await api.issues.list(currentProject.id);
          setIssues(issueList);
        }
        const activityList = await api.workspaces.activity(currentWorkspace.id);
        setActivities(activityList);
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
  }, [currentWorkspace?.id, currentProject?.id]);

  const assignedToMe = issues.filter((i) => i.assignee_id === user?.id);
  const inProgressIssues = issues.filter((i) => i.status_category === "InProgress");
  const doneIssues = issues.filter((i) => i.status_category === "Done");

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-card to-card border border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Welcome back, {user?.name.split(" ")[0]} 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Here is what's happening across your active workspace and projects today.
          </p>
        </div>
        <Button onClick={onOpenCreateIssue} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          <span>New Issue</span>
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Issues</span>
            <Kanban className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{issues.length}</div>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Assigned to Me</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{assignedToMe.length}</div>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{inProgressIssues.length}</div>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{doneIssues.length}</div>
        </div>
      </div>

      {/* Content Grid: Assigned Issues & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Issues */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Assigned to You</h2>
              <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                {assignedToMe.length}
              </span>
            </div>
            <Link
              to="/kanban"
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
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${typeBadge.color}`}>
                      {typeBadge.label}
                    </span>
                    <span className="font-mono font-semibold text-primary">{issue.identifier}</span>
                    <span className="font-medium text-foreground truncate">{issue.title}</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase ${priorityStyle}`}>
                    {issue.priority}
                  </span>
                </div>
              );
            })}

            {assignedToMe.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground/60 italic">
                No issues currently assigned to you!
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
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

            {activities.length === 0 && (
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
