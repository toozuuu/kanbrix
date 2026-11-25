import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Project, Workspace } from "../types";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

type WorkspaceContextType = {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  projects: Project[];
  projectStatus: "loading" | "ready" | "error";
  currentProject: Project | null;
  isLoading: boolean;
  setCurrentWorkspace: (workspace: Workspace) => void;
  setCurrentProject: (project: Project | null) => void;
  refreshWorkspaces: () => Promise<void>;
  refreshProjects: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [projectStatus, setProjectStatus] = useState<WorkspaceContextType["projectStatus"]>("loading");
  const projectRequest = useRef(0);
  const workspaceRequest = useRef(0);
  const activeWs=useRef(currentWorkspace?.id);
  activeWs.current=currentWorkspace?.id;
  const refreshWorkspaces = async () => {
    const request = ++workspaceRequest.current;
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setProjects([]);
      setCurrentProject(null);
      setIsLoading(false);
      return;
    }

    try {
      const list = await api.workspaces.list();
      if (request !== workspaceRequest.current) return;
      setWorkspaces(list);

      // Auto-select first workspace or restore saved
      if (list.length > 0) {
        const savedId = localStorage.getItem("rusttrack-active-workspace");
        const active = list.find((w) => w.id === savedId) || list[0];
        setCurrentWorkspace(active);
      } else {
        ++projectRequest.current;
        setProjects([]);
        setCurrentProject(null);
        setCurrentWorkspaceState(null);
      }
    } catch (e) {
      console.error("Failed to load workspaces", e);
    } finally {
      if (request === workspaceRequest.current) setIsLoading(false);
    }
  };

  const refreshProjects = async () => {
    if (!currentWorkspace) {
      setProjects([]);
      setCurrentProject(null);
      return;
    }

    const request = ++projectRequest.current;
    setProjectStatus("loading");
    try {
      const list = await api.projects.list(currentWorkspace.id);
      if(activeWs.current !== currentWorkspace.id || request !== projectRequest.current) return;
      setProjectStatus("ready");
      setProjects(list);
      if (list.length > 0) {
        const savedProjectId = localStorage.getItem("rusttrack-active-project");
        const active = list.find((p) => p.id === savedProjectId) || list[0];
        setCurrentProject(active);
      } else {
        setCurrentProject(null);
      }
    } catch (e) {
      if (activeWs.current === currentWorkspace.id && request === projectRequest.current) setProjectStatus("error");
    }
  };

  useEffect(() => {
    refreshWorkspaces();
  }, [user]);

  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem("rusttrack-active-workspace", currentWorkspace.id);
      refreshProjects();
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (currentProject) {
      localStorage.setItem("rusttrack-active-project", currentProject.id);
    }
  }, [currentProject?.id]);

  const setCurrentWorkspace = (ws: Workspace) => {
    if(ws.id!==activeWs.current){activeWs.current=ws.id;setProjectStatus("loading");setProjects([]);setCurrentProject(null);}
    setCurrentWorkspaceState(ws);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        projects,
        projectStatus,
        currentProject,
        isLoading,
        setCurrentWorkspace,
        setCurrentProject,
        refreshWorkspaces,
        refreshProjects,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
