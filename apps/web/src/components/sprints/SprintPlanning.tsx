import { SelectBox } from "../ui/SelectBox";
import { Sprint, Issue } from "../../types";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { api } from "../../lib/api";
import { useToast } from "../ui/Toast";
import { getPriorityColor, getTypeBadge } from "../../lib/utils";
import { Play, CheckCircle2, Layers, Plus } from "lucide-react";
import { LabelBadge } from "../ui/LabelBadge";

interface SprintPlanningProps {
  sprints: Sprint[];
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
  onRefresh: () => void;
  onOpenNewSprint: () => void;
  onOpenNewIssue: () => void;
}

export function SprintPlanning({
  sprints,
  issues,
  onIssueClick,
  onRefresh,
  onOpenNewSprint,
  onOpenNewIssue,
}: SprintPlanningProps) {
  const { toast } = useToast();

  const handleStartSprint = async (sprintId: string) => {
    try {
      await api.sprints.start(sprintId);
      toast("Sprint started!", "success");
      onRefresh();
    } catch (e: any) {
      toast(e.message || "Failed to start sprint", "error");
    }
  };

  const handleCompleteSprint = async (sprintId: string) => {
    try {
      await api.sprints.complete(sprintId);
      toast("Sprint completed! Unfinished items moved to backlog.", "success");
      onRefresh();
    } catch (e: any) {
      toast(e.message || "Failed to complete sprint", "error");
    }
  };

  const handleAssignToSprint = async (issueId: string, sprintId: string | null) => {
    try {
      await api.issues.update(issueId, { sprint_id: sprintId });
      toast("Issue updated", "success");
      onRefresh();
    } catch (e: any) {
      toast(e.message || "Failed to assign issue", "error");
    }
  };

  const activeSprint = sprints.find((s) => s.status === "active");
  const plannedSprints = sprints.filter((s) => s.status === "planned");
  const bySprint = new Map<string, Issue[]>();
  for (const issue of issues) {
    const key = issue.sprint_id ?? "";
    const group = bySprint.get(key);
    if (group) group.push(issue);
    else bySprint.set(key, [issue]);
  }
  const backlogIssues = bySprint.get("") ?? [];

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Sprint Planning & Backlog</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organize upcoming work into iteration cycles and manage your project backlog.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpenNewSprint} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span>New Sprint</span>
          </Button>
          <Button size="sm" onClick={onOpenNewIssue} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span>New Issue</span>
          </Button>
        </div>
      </div>

      {/* Active Sprint Section */}
      {activeSprint && (
        <div className="rounded-xl border border-l-4 border-primary/30 border-l-primary bg-card p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-bold text-foreground">{activeSprint.name}</h3>
              <span className="text-[10px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                Active Sprint
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCompleteSprint(activeSprint.id)}
              className="gap-1.5 text-xs border-primary/40 hover:bg-primary/10 hover:border-primary/50"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Complete Sprint</span>
            </Button>
          </div>

          {activeSprint.goal && (
            <p className="text-xs text-muted-foreground italic">Goal: "{activeSprint.goal}"</p>
          )}

          {/* Active sprint issues */}
          <div className="space-y-1.5 pt-1">
            {(bySprint.get(activeSprint.id) ?? [])
              .map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => onIssueClick(issue)}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-secondary/30 hover:border-primary/40 transition-colors cursor-pointer text-xs"
                >
                  <div className="flex flex-col gap-1 truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-primary">{issue.identifier}</span>
                      <span className="font-medium text-foreground truncate">{issue.title}</span>
                    </div>
                    {!!issue.labels?.length && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {issue.labels.map(label => (
                          <LabelBadge key={label.id} label={label} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                      {issue.status_name}
                    </span>
                    {issue.assignee_name && <Avatar name={issue.assignee_name} size="sm" />}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Planned Sprints */}
      {plannedSprints.map((sprint) => {
        const sprintIssues = bySprint.get(sprint.id) ?? [];

        return (
          <div key={sprint.id} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">{sprint.name}</h3>
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-semibold text-muted-foreground">
                  {sprintIssues.length} issues
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStartSprint(sprint.id)}
                className="gap-1.5 text-xs"
              >
                <Play className="h-3.5 w-3.5 text-primary" />
                <span>Start Sprint</span>
              </Button>
            </div>

            {sprint.goal && (
              <p className="text-xs text-muted-foreground italic">Goal: "{sprint.goal}"</p>
            )}

            <div className="space-y-1.5 pt-1">
              {sprintIssues.map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => onIssueClick(issue)}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-secondary/30 hover:border-primary/40 transition-colors cursor-pointer text-xs"
                >
                  <div className="flex flex-col gap-1 truncate">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-semibold text-primary">{issue.identifier}</span>
                      <span className="font-medium text-foreground truncate">{issue.title}</span>
                    </div>
                    {!!issue.labels?.length && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {issue.labels.map(label => (
                          <LabelBadge key={label.id} label={label} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAssignToSprint(issue.id, null);
                      }}
                      className="text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded border border-border hover:bg-accent transition-colors"
                    >
                      Move to Backlog
                    </button>
                    {issue.assignee_name && <Avatar name={issue.assignee_name} size="sm" />}
                  </div>
                </div>
              ))}

              {sprintIssues.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground/60 border border-dashed border-border/50 rounded-lg">
                  No issues in this sprint. Move issues here from the backlog below.
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Product Backlog Section */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Backlog</h3>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-semibold text-muted-foreground">
              {backlogIssues.length} issues
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          {backlogIssues.map((issue) => {
            const priorityStyle = getPriorityColor(issue.priority);
            const typeBadge = getTypeBadge(issue.type);

            return (
              <div
                key={issue.id}
                onClick={() => onIssueClick(issue)}
                className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-secondary/30 hover:border-primary/40 transition-colors cursor-pointer text-xs group"
              >
                <div className="flex flex-col gap-1 truncate">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${typeBadge.color}`}>
                      {typeBadge.label}
                    </span>
                    <span className="font-mono font-semibold text-primary">{issue.identifier}</span>
                    <span className="font-medium text-foreground truncate">{issue.title}</span>
                  </div>
                  {!!issue.labels?.length && (
                    <div className="flex items-center gap-1 flex-wrap opacity-70">
                      {issue.labels.map(label => (
                        <LabelBadge key={label.id} label={label} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase ${priorityStyle}`}>
                    {issue.priority}
                  </span>

                  {/* Move to sprint selector */}
                  {sprints.length > 0 && (
                    <SelectBox aria-label={`Move ${issue.title} to sprint`}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const targetSprintId = e.target.value || null;
                        handleAssignToSprint(issue.id, targetSprintId);
                      }}
                      value=""
                    >
                      <option value="" disabled>
                        Move to Sprint...
                      </option>
                      {sprints.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.status})
                        </option>
                      ))}
                    </SelectBox>
                  )}

                  {issue.assignee_name && <Avatar name={issue.assignee_name} size="sm" />}
                </div>
              </div>
            );
          })}

          {backlogIssues.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground/60 border border-dashed border-border/50 rounded-lg">
              Your backlog is clear! Create an issue to plan your next sprint.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
