import { useEffect, useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { api } from "../lib/api";
import { Issue, IssueStatus } from "../types";
import { KanbanBoard } from "../components/kanban/KanbanBoard";
import { FilterBar } from "../components/issues/FilterBar";
import { Button } from "../components/ui/Button";
import { Plus, Kanban as KanbanIcon } from "lucide-react";

interface KanbanPageProps {
  onIssueClick: (issue: Issue) => void;
  onAddIssueToStatus: (statusId?: string) => void;
}

export function KanbanPage({ onIssueClick, onAddIssueToStatus }: KanbanPageProps) {
  const { currentProject } = useWorkspace();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<string | undefined>();
  const [type, setType] = useState<string | undefined>();

  const loadData = async () => {
    if (!currentProject) return;
    try {
      const proj = await api.projects.get(currentProject.id);
      if (proj.statuses) {
        setStatuses(proj.statuses);
      }

      const issueList = await api.issues.list(currentProject.id, {
        search,
        priority,
        type,
      });
      setIssues(issueList);
    } catch (e) {
      console.error("Failed to load kanban data", e);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentProject?.id, search, priority, type]);

  if (!currentProject) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center space-y-3">
        <KanbanIcon className="h-10 w-10 text-muted-foreground/60" />
        <h2 className="text-base font-semibold text-foreground">No Project Selected</h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          Please select a project from the sidebar or create a new project in your workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <div>
          <h1 className="text-base font-bold text-foreground tracking-tight">Kanban Board</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {currentProject.name} • {issues.length} total issues
          </p>
        </div>

        <Button size="sm" onClick={() => onAddIssueToStatus()} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>New Issue</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        priority={priority}
        onPriorityChange={setPriority}
        type={type}
        onTypeChange={setType}
        onClear={() => {
          setSearch("");
          setPriority(undefined);
          setType(undefined);
        }}
      />

      {/* Kanban Board Canvas */}
      <div className="flex-1 overflow-hidden min-h-0">
        <KanbanBoard
          statuses={statuses}
          issues={issues}
          onIssueClick={onIssueClick}
          onAddIssueToStatus={(statusId) => onAddIssueToStatus(statusId)}
          onRefresh={loadData}
        />
      </div>
    </div>
  );
}
