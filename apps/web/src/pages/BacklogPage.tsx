import { useEffect, useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { api } from "../lib/api";
import { Issue, Sprint } from "../types";
import { SprintPlanning } from "../components/sprints/SprintPlanning";
import { NewSprintModal } from "../components/sprints/NewSprintModal";
import { ListTodo } from "lucide-react";

interface BacklogPageProps {
  onIssueClick: (issue: Issue) => void;
  onOpenNewIssue: () => void;
}

export function BacklogPage({ onIssueClick, onOpenNewIssue }: BacklogPageProps) {
  const { currentProject } = useWorkspace();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isNewSprintModalOpen, setIsNewSprintModalOpen] = useState(false);

  const loadData = async () => {
    if (!currentProject) return;
    try {
      const [sprintList, issueList] = await Promise.all([
        api.sprints.list(currentProject.id),
        api.issues.list(currentProject.id),
      ]);

      setSprints(sprintList);
      setIssues(issueList);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentProject?.id]);

  if (!currentProject) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center space-y-3">
        <ListTodo className="h-10 w-10 text-muted-foreground/60" />
        <h2 className="text-base font-semibold text-foreground">No Project Selected</h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          Please select a project from the sidebar to plan sprints and view the backlog.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SprintPlanning
        sprints={sprints}
        issues={issues}
        onIssueClick={onIssueClick}
        onRefresh={loadData}
        onOpenNewSprint={() => setIsNewSprintModalOpen(true)}
        onOpenNewIssue={onOpenNewIssue}
      />

      <NewSprintModal
        isOpen={isNewSprintModalOpen}
        onClose={() => setIsNewSprintModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
