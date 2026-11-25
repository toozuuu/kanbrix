import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { api } from "../lib/api";
import type { Issue, Project } from "../types";
import { Button } from "../components/ui/Button";
import { ProjectSpinner } from "../components/ui/ProjectSpinner";
import { useToast } from "../components/ui/Toast";
import { useCalendar } from "./PersonalSettings";

export function MyWorkPage({ onSelectIssue }: { onSelectIssue: (issue: Issue, project: Project) => void }) {
  const { user } = useAuth();
  const { currentWorkspace, isLoading } = useWorkspace();
  const { toast } = useToast();
  const today = useCalendar().day();
  const [offsets, setOffsets] = useState([0]);
  const offset = offsets[offsets.length - 1];
  const workspaceId = currentWorkspace?.id;
  const work = useQuery({
    queryKey: ["my-work", user?.id, workspaceId, offset],
    enabled: !!workspaceId && !!user,
    queryFn: () => api.workspaces.myWork(workspaceId!, offset),
  });
  const openIssue = useMutation({
    mutationFn: async (issueId: string) => {
      const issue = await api.issues.get(issueId);
      const project = await api.projects.get(issue.project_id);
      if (project.workspace_id !== workspaceId) throw new Error("Issue is outside the selected workspace");
      return { issue, project };
    },
  });
  const next = work.data?.next_offset;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="page-header">
        <div>
          {currentWorkspace && <p className="mb-1 text-sm text-muted-foreground">{currentWorkspace.name}</p>}
          <h1 className="page-heading">My Work</h1>
        </div>
      </header>
      {isLoading || (workspaceId && work.isPending) ? <ProjectSpinner message="Loading assignments." /> :
        !workspaceId ? <p className="text-sm text-muted-foreground">Select a workspace to see your assignments.</p> :
        work.isError ? (
          <p role="alert" className="text-sm">
            Could not load your assignments.{" "}
            <button type="button" className="text-primary underline" onClick={() => void work.refetch()}>Retry</button>
          </p>
        ) : (
          <section aria-label="Open assignments" className="rounded-xl border border-border bg-card">
            {work.data?.items.length ? (
              <ul className="divide-y divide-border/75">
                {work.data.items.map(item => {
                  const date = item.due_date?.slice(0, 10);
                  return (
                    <li key={item.id}>
                      <button type="button"
                        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-accent/60 focus-visible:outline-offset-[-3px] sm:px-5"
                        onClick={() => openIssue.mutate(item.id, {
                          onSuccess: ({ issue, project }) => onSelectIssue(issue, project),
                          onError: () => toast("Could not open the issue.", "error"),
                        })}
                        disabled={openIssue.isPending && openIssue.variables === item.id}
                      >
                        <span className="min-w-0 space-y-1">
                          <span className="block break-words text-sm font-medium">{item.title}</span>
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-xs text-muted-foreground">
                            <span className="font-mono">{item.identifier}</span>
                            <span>{item.project_name}</span>
                            <span>{item.status_name}</span>
                          </span>
                        </span>
                        <span className="flex items-center gap-2 text-xs">
                          {date && (
                            <time dateTime={date} className={date < today ? "font-medium text-destructive" : "text-muted-foreground"}>
                              {date}
                            </time>
                          )}
                          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="p-5 text-sm text-muted-foreground">{offset ? "No more open assignments." : "You have no open assignments in this workspace."}</p>}
            {(offset > 0 || next != null) && (
              <nav aria-label="Assignment pages" className="flex justify-end gap-2 border-t border-border px-4 py-3">
                <Button type="button" size="sm" variant="outline" disabled={!offset} onClick={() => setOffsets(previous => previous.slice(0, -1))}>
                  Previous
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={next == null} onClick={() => {
                  if (next != null) setOffsets(previous => [...previous, next]);
                }}>
                  Next
                </Button>
              </nav>
            )}
          </section>
        )}
    </div>
  );
}
