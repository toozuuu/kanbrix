import {LanguageSync} from "./context/LanguageSync";
import {api} from "./lib/api";
import {useToast} from "./components/ui/Toast";
import { useWorkflow } from "./context/useWorkflow";
import { useConfiguration } from "./context/useConfiguration";
import { useState,useEffect,lazy,Suspense } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useWorkspace } from "./context/WorkspaceContext";

// Pages
import { DashboardPage } from "./pages/DashboardPage";
import { KanbanPage } from "./pages/KanbanPage";
import { BacklogPage } from "./pages/BacklogPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { MembersPage } from "./pages/MembersPage";
const SettingsPage=lazy(()=>import("./pages/SettingsPage").then(m=>({default:m.SettingsPage})));

// Layout & Global Modals
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { CommandPalette } from "./components/layout/CommandPalette";
import { KeyboardShortcuts } from "./components/layout/KeyboardShortcuts";
import { NewIssueModal } from "./components/kanban/NewIssueModal";
import { IssueDetailModal } from "./components/issues/IssueDetailModal";
import { ProjectSpinner } from "./components/ui/ProjectSpinner";
import { Issue } from "./types";

function accentStyle(hex:string):React.CSSProperties {
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b), delta=max-min, light=(max+min)/2;
  const hue=delta===0?0:max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4;
  const saturation=delta===0?0:delta/(1-Math.abs(2*light-1));
  const color=`${(hue*60+360)%360} ${saturation*100}% ${light*100}%`;
  const linear=[r,g,b].map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
  const luminance=linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
  return {"--primary":color,"--ring":color,"--primary-foreground":luminance>0.179?"0 0% 0%":"0 0% 100%"} as React.CSSProperties;
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
  const [refreshKey, setRefreshKey] = useState(0);

  const {toast}=useToast();
  const navigate = useNavigate();

  useEffect(()=>{setSelectedIssue(prev=>prev?.project_id===currentProject?.id?prev:null);setIsCreateIssueOpen(false);},[currentProject?.id,currentWorkspace?.id]);

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
          setRefreshKey(k=>k+1);
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

  const handleOpenCreateIssue = (statusId?: string) => {
    setInitialStatusId(statusId);
    setIsCreateIssueOpen(true);
  };

  const statuses = workflow.data?.columns.map((c,i)=>({...c,category:c.category as import("./types").IssueStatus["category"],position:i*1000})) ?? currentProject?.statuses ?? [];

  return (
    <div style={cfg?.accent ? accentStyle(cfg.accent) : undefined} className="flex flex-col h-dvh w-full overflow-hidden bg-background text-foreground">
        <LanguageSync/>
        <Header
          onOpenCreateIssue={() => handleOpenCreateIssue()}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenKeyboardShortcuts={() => setIsKeyboardShortcutsOpen(true)}
        />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6" key={refreshKey}>
          <Routes>
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
                workflow.data?.sprints===false ? <Navigate to="/kanban" replace/> : <BacklogPage
                  onIssueClick={(issue) => setSelectedIssue(issue)}
                  onOpenNewIssue={() => handleOpenCreateIssue()}
                />
              }
            />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/settings" element={<Suspense fallback={<p role="status">Loading settings…</p>}><SettingsPage key={currentWorkspace?.id} /></Suspense>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* Global New Issue Modal */}
      <NewIssueModal key={currentProject?.id}
        isOpen={isCreateIssueOpen}
        onClose={() => setIsCreateIssueOpen(false)}
        statuses={statuses}
        initialStatusId={initialStatusId}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />

      {/* Global Issue Detail Modal */}
      <IssueDetailModal
        isOpen={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
        issue={selectedIssue}
        statuses={statuses}
        onIssueUpdated={(updated) => {
          setSelectedIssue(current => current?.id === updated.id ? updated : current);
          setRefreshKey(key => key + 1);
        }}
        onIssueDeleted={() => {
          setSelectedIssue(null);
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* Global Command Palette */}
      <CommandPalette
        onToggle={() => setIsCommandPaletteOpen(open => !open)}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectIssue={(issue) => setSelectedIssue(issue)}
      />

      {/* Global Keyboard Shortcuts Help */}
      <KeyboardShortcuts
        isOpen={isKeyboardShortcutsOpen}
        onClose={() => setIsKeyboardShortcutsOpen(false)}
      />
    </div>
  );
}

