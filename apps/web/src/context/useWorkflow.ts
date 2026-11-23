import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { useWorkspace } from "./WorkspaceContext";
import { request } from "../lib/api";
export interface Column {
  id: string;
  name: string;
  category: string;
  issues: number;
}
export interface Workflow {
  form: import("../types/configuration").FormOverrides;
  revision: number;
  sprints: boolean;
  columns: Column[];
  delegates: string[];
  transitions: string[][];
  admin: boolean;
  editable: boolean;
}
export function useWorkflow() {
  const { currentProject, currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      "workflow-settings",
      user?.id,
      currentWorkspace?.id,
      currentProject?.id,
    ],
    enabled:
      !!currentProject && currentProject.workspace_id === currentWorkspace?.id,
    queryFn: () =>
      request<Workflow>(`/projects/${currentProject!.id}/workflow`),
  });
}
