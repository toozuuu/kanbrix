import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "./WorkspaceContext";
import { useAuth } from "./AuthContext";
import { api } from "../lib/api";

export function useConfiguration() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["configuration", user?.id, currentWorkspace?.id],
    enabled: !!user && !!currentWorkspace,
    queryFn: () => api.configuration.read(currentWorkspace!.id),
  });
}
