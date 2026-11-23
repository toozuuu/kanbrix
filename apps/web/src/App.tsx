import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WorkspaceProvider, useWorkspace } from "./context/WorkspaceContext";
import { ToastProvider } from "./components/ui/Toast";

// Pages
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { KanbanPage } from "./pages/KanbanPage";
import { BacklogPage } from "./pages/BacklogPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { MembersPage } from "./pages/MembersPage";
import { SettingsPage } from "./pages/SettingsPage";

// Layout & Global Modals
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { CommandPalette } from "./components/layout/CommandPalette";
import { NewIssueModal } from "./components/kanban/NewIssueModal";
import { IssueDetailModal } from "./components/issues/IssueDetailModal";
import { Issue } from "./types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
});

function ProtectedLayout() {
  const { user, isLoading } = useAuth();
  const { currentProject } = useWorkspace();
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [initialStatusId, setInitialStatusId] = useState<string | undefined>();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs font-medium text-muted-foreground">Loading RustTrack...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleOpenCreateIssue = (statusId?: string) => {
    setInitialStatusId(statusId);
    setIsCreateIssueOpen(true);
  };

  const statuses = currentProject?.statuses || [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        <Header
          onOpenCreateIssue={() => handleOpenCreateIssue()}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-6" key={refreshKey}>
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
                <BacklogPage
                  onIssueClick={(issue) => setSelectedIssue(issue)}
                  onOpenNewIssue={() => handleOpenCreateIssue()}
                />
              }
            />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* Global New Issue Modal */}
      <NewIssueModal
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
        onIssueUpdated={() => setRefreshKey((k) => k + 1)}
        onIssueDeleted={() => {
          setSelectedIssue(null);
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectIssue={(issue) => setSelectedIssue(issue)}
      />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <ToastProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/*" element={<ProtectedLayout />} />
                </Routes>
              </BrowserRouter>
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
