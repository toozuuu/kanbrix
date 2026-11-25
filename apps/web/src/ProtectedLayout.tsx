import { useQueryClient } from "@tanstack/react-query";
import {LanguageSync} from "./context/LanguageSync";
import {api} from "./lib/api";
import {useToast} from "./components/ui/Toast";
import { useWorkflow } from "./context/useWorkflow";
import { useConfiguration } from "./context/useConfiguration";
import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useMatch, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { IssueProjectScope, useWorkspace } from "./context/WorkspaceContext";

// Pages (code-split per route)
const DashboardPage = lazy(() => import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const MyWorkPage = lazy(() => import("./pages/MyWorkPage").then(m => ({ default: m.MyWorkPage })));
const KanbanPage = lazy(() => import("./pages/KanbanPage").then(m => ({ default: m.KanbanPage })));
const BacklogPage = lazy(() => import("./pages/BacklogPage").then(m => ({ default: m.BacklogPage })));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage").then(m => ({ default: m.ProjectsPage })));
const MembersPage = lazy(() => import("./pages/MembersPage").then(m => ({ default: m.MembersPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage })));

// Layout & Global Modals
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { ProjectSpinner } from "./components/ui/ProjectSpinner";
import type { Issue, Project } from "./types";

const CommandPalette = lazy(() => import("./components/layout/CommandPalette").then(m => ({ default: m.CommandPalette })));
const KeyboardShortcuts = lazy(() => import("./components/layout/KeyboardShortcuts").then(m => ({ default: m.KeyboardShortcuts })));
const NewIssueModal = lazy(() => import("./components/kanban/NewIssueModal").then(m => ({ default: m.NewIssueModal })));
const IssueDetailModal = lazy(() => import("./components/issues/IssueDetailModal").then(m => ({ default: m.IssueDetailModal })));

function accentStyle(hex:string):React.CSSProperties {
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b), delta=max-min, light=(max+min)/2;
  const hue=delta===0?0:max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4;
  const saturation=delta===0?0:delta/(1-Math.abs(2*light-1));
  const color=`${(hue*60+360)%360} ${saturation*100}% ${light*100}%`;
  const linear=[r,g,b].map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
  const luminance=linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
  return {"--brand-hue":String((hue*60+360)%360),"--brand-saturation":saturation*100+"%","--brand-lightness":light*100+"%","--brand-color":color,"--brand-foreground":luminance>0.179?"0 0% 0%":"0 0% 100%"} as React.CSSProperties;
}
export default function ProtectedLayout() {
  const { user, isLoading } = useAuth();
  const workflow=useWorkflow();
  const cfg=useConfiguration().data?.configuration;
  const { currentProject,currentWorkspace } = useWorkspace();
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [initialStatusId, setInitialStatusId] = useState<string | undefined>();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedIssueProject, setSelectedIssueProject] = useState<Project | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const client = useQueryClient();
  const refreshIssueViews = useCallback(() => {
    for (const key of ["dashboard-issues", "my-work", "workspace-activity", "board-issues", "project-labels", "get"]) {
      void client.invalidateQueries({queryKey: key === "get" ? [key, "/api/v1/projects/{project}/report"] : [key]});
    }
    setRefreshKey(key => key + 1);
  }, [client]);

  const {toast}=useToast();
  const navigate = useNavigate();
  const isProjectsPage = useMatch("/projects") !== null;
  const isSettingsPage = useMatch("/settings") !== null;
  const isMyWorkPage = useMatch("/my-work") !== null;
  const routesKey = isProjectsPage || isSettingsPage || isMyWorkPage
    ? currentWorkspace?.id
    : `${currentWorkspace?.id}/${currentProject?.id}`;

  const canOpenWorkspaceIssue = isMyWorkPage && selectedIssueProject?.workspace_id === currentWorkspace?.id;
  const detailProject = selectedIssue?.project_id === currentProject?.id
    ? currentProject
    : canOpenWorkspaceIssue && selectedIssue?.project_id === selectedIssueProject?.id ? selectedIssueProject : null;

  useEffect(() => {
    setSelectedIssue(previous => (
      previous?.project_id === currentProject?.id ||
      (canOpenWorkspaceIssue && previous?.project_id === selectedIssueProject?.id)
    ) ? previous : null);
  }, [currentProject?.id, currentWorkspace?.id, canOpenWorkspaceIssue, selectedIssueProject?.id]);
  useEffect(() => setIsCreateIssueOpen(false), [currentProject?.id, currentWorkspace?.id]);

  // Keyboard shortcuts handler (Jira-like hotkeys)
  useEffect(()=>{
    let chordDeadline = 0;

    function shortcut(e:KeyboardEvent){
      if(e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || !user || (e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable=true]")))return;
      const now = performance.now();
      const pendingGKey = now < chordDeadline;
      chordDeadline = 0;

      // `.` - Open Command Palette (same as pressing ⌘K / Ctrl+K)
      if(e.key==="." && !isCommandPaletteOpen && !isCreateIssueOpen && !selectedIssue && !document.querySelector("dialog[open],[role=dialog]")){
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // `c` - Create new issue
      if(e.key==="c" && currentProject && !isCommandPaletteOpen && !isCreateIssueOpen && !selectedIssue && !document.querySelector("dialog[open],[role=dialog]")){
        e.preventDefault();
        setInitialStatusId(undefined);
        setIsCreateIssueOpen(true);
        return;
      }

      // `g` - Start a chord (wait for next key)
      if(e.key==="g" && !isCommandPaletteOpen && !isCreateIssueOpen && !selectedIssue && !document.querySelector("dialog[open],[role=dialog]")){
        e.preventDefault();
        chordDeadline = now + 500;
        return;
      }

      // Handle `g` prefix chords (g k, g b, g p, g d, g m)
      if(pendingGKey){
        switch(e.key){
          case "k": e.preventDefault(); navigate("/kanban"); return;
          case "b": e.preventDefault(); navigate("/backlog"); return;
          case "p": e.preventDefault(); navigate("/projects"); return;
          case "d": e.preventDefault(); navigate("/dashboard"); return;
          case "m": e.preventDefault(); navigate("/members"); return;
        }
        return;
      }

      // `l` - Assign selected issue to yourself (with selected issue open)
      if(e.key==="l" && selectedIssue && !isCommandPaletteOpen){
        e.preventDefault();
        void api.issues.update(selectedIssue.id,{assignee_id:user.id}).then(updated=>{
          setSelectedIssue(updated);
          refreshIssueViews();
          toast("Issue assigned to you","success");
        }).catch(()=>toast("Could not assign issue","error"));
        return;
      }

      // `/` - Open Command Palette with focus on search
      if(e.key==="/" && !isCommandPaletteOpen && !isCreateIssueOpen && !selectedIssue && !document.querySelector("dialog[open],[role=dialog]")){
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }
    }
    window.addEventListener("keydown",shortcut);
    return ()=>window.removeEventListener("keydown",shortcut);
  },[user,currentProject,selectedIssue,isCreateIssueOpen,isCommandPaletteOpen,toast,navigate]);
  const handleOpenCreateIssue = useCallback((statusId?: string) => {
    setInitialStatusId(statusId);
    setIsCreateIssueOpen(true);
  }, []);

  const statuses = useMemo(
    () =>
      workflow.data?.columns.map((c, i) => ({
        ...c,
        category: c.category as import("./types").IssueStatus["category"],
        position: i * 1000,
      })) ?? currentProject?.statuses ?? [],
    [workflow.data?.columns, currentProject?.statuses],
  );

  if (isLoading) {
    return (
      <ProjectSpinner
        fullScreen
        message="Loading Kanbrix…"
        subMessage={currentWorkspace ? `Connecting to ${currentWorkspace.name}` : "Initializing your workspace"}
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={cfg?.accent ? accentStyle(cfg.accent) : undefined} className={`flex flex-col h-dvh w-full overflow-hidden bg-background text-foreground ${cfg?.accent ? "workspace-brand" : ""}`}>
        <LanguageSync/>
        <a href="#workspace-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-3">Skip to workspace content</a>
        <Header
          onOpenCreateIssue={() => handleOpenCreateIssue()}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenKeyboardShortcuts={() => setIsKeyboardShortcutsOpen(true)}
        />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <main id="workspace-content" tabIndex={-1} className={`min-w-0 flex-1 overflow-y-auto p-3 sm:p-6${isSettingsPage ? " [scrollbar-gutter:stable]" : ""}`}>
          <Suspense fallback={<ProjectSpinner size="sm" message="Loading page…" />}>
            <Routes key={routesKey}>
              <Route
                path="/dashboard"
                element={
                  <DashboardPage
                    onOpenCreateIssue={() => handleOpenCreateIssue()}
                    onSelectIssue={(issue) => setSelectedIssue(issue)}
                  />
                }
              />
              <Route
                path="/kanban"
                element={
                  <KanbanPage
                    onIssueClick={(issue) => setSelectedIssue(issue)}
                    onAddIssueToStatus={(statusId) => handleOpenCreateIssue(statusId)}
                  />
                }
              />
              <Route
                path="/backlog"
                element={
                  workflow.data?.sprints===false ? <Navigate to="/kanban" replace/> : <BacklogPage key={refreshKey}
                    onIssueClick={(issue) => setSelectedIssue(issue)}
                    onOpenNewIssue={() => handleOpenCreateIssue()}
                  />
                }
              />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/my-work" element={<MyWorkPage onSelectIssue={(issue, project) => {
                setSelectedIssueProject(project);
                setSelectedIssue(issue);
              }} />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Global New Issue Modal */}
      {isCreateIssueOpen && (
        <Suspense fallback={null}>
          <NewIssueModal key={currentProject?.id}
            isOpen={isCreateIssueOpen}
            onClose={() => setIsCreateIssueOpen(false)}
            statuses={statuses}
            initialStatusId={initialStatusId}
            onSuccess={refreshIssueViews}
          />
        </Suspense>
      )}

      {/* Global Issue Detail Modal */}
      {selectedIssue && detailProject && (
        <Suspense fallback={null}>
          <IssueProjectScope project={detailProject}>
          <IssueDetailModal
            isOpen={Boolean(selectedIssue)}
            onClose={() => setSelectedIssue(null)}
            issue={selectedIssue}
            statuses={detailProject.id === currentProject?.id ? statuses : detailProject.statuses ?? []}
            onIssueUpdated={(updated) => {
              setSelectedIssue(current => current?.id === updated.id ? updated : current);
              refreshIssueViews();
            }}
            onIssueDeleted={() => {
              setSelectedIssue(null);
              refreshIssueViews();
            }}
          />
          </IssueProjectScope>
        </Suspense>
      )}

      {/* Global Command Palette */}
      <Suspense fallback={null}>
        <CommandPalette
          onToggle={() => setIsCommandPaletteOpen(open => !open)}
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onSelectIssue={(issue) => setSelectedIssue(issue)}
        />
      </Suspense>

      {/* Global Keyboard Shortcuts Help */}
      {isKeyboardShortcutsOpen && (
        <Suspense fallback={null}>
          <KeyboardShortcuts
            isOpen={isKeyboardShortcutsOpen}
            onClose={() => setIsKeyboardShortcutsOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

