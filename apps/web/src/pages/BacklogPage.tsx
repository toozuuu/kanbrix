import { ProjectEmptyState } from "../components/ui/ProjectEmptyState";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { api } from "../lib/api";
import { Issue, Sprint } from "../types";
import { SprintPlanning } from "../components/sprints/SprintPlanning";
import { NewSprintModal } from "../components/sprints/NewSprintModal";
import { ProjectSpinner } from "../components/ui/ProjectSpinner";

interface BacklogPageProps {
  onIssueClick: (issue: Issue) => void;
  onOpenNewIssue: () => void;
}

export function BacklogPage({ onIssueClick, onOpenNewIssue }: BacklogPageProps) {
  const { currentProject } = useWorkspace();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isNewSprintModalOpen, setIsNewSprintModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [loadFailed, setLoadFailed] = useState(false);
  const latestRequest = useRef(0);
  const projectId = currentProject?.id;

  const loadData = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoadFailed(false);
    if (!projectId) {
      setIsLoading(false);
      return;
    }
    try {
      const [sprintList, issueList] = await Promise.all([
        api.sprints.list(projectId),
        api.issues.list(projectId),
      ]);

      if (request !== latestRequest.current) return;
      setSprints(sprintList);
      setIssues(issueList);
    } catch {
      if (request === latestRequest.current) setLoadFailed(true);
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setIsLoading(true);
    void loadData();
    return () => { latestRequest.current++; };
  }, [loadData]);

  if (!currentProject) return <ProjectEmptyState/>;

  if (isLoading) {
    return (
      <ProjectSpinner
        message="Loading backlog & sprintsâ€¦"
        subMessage={`Project: ${currentProject.name}`}
      />
    );
  }

  if (loadFailed) {
    return <section className="space-y-3 py-6">
      <h1 className="page-heading">Backlog</h1>
      <p role="alert">Could not load this project’s sprints and issues.</p>
      <button className="min-h-11 text-primary underline" onClick={() => { setIsLoading(true); void loadData(); }}>Retry</button>
    </section>;
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
