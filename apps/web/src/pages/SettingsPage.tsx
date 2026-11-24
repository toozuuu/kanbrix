import { PersonalSettings } from "./PersonalSettings";
import { WorkflowSettings } from "./WorkflowSettings";
import { IntegrationSettings } from "./IntegrationSettings";
import { OrganizationSettings } from "./OrganizationSettings";
import React, { useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { useToast } from "../components/ui/Toast";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Modal } from "../components/ui/Modal";
import { Building2, SlidersHorizontal, Workflow, Cable, UserRound, Info, Trash2, Pencil } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Project, Workspace } from "../types";

const sections = [
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "organization", label: "Organization", icon: SlidersHorizontal },
  { id: "workflow", label: "Project workflow", icon: Workflow },
  { id: "integrations", label: "Integrations", icon: Cable },
  { id: "personal", label: "Personal settings", icon: UserRound },
  { id: "system", label: "System information", icon: Info },
];

export function SettingsPage() {
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    refreshWorkspaces,
    projects,
    currentProject,
    setCurrentProject,
    refreshProjects,
  } = useWorkspace();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name || "");
  const [isLoading, setIsLoading] = useState(false);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [editWsName, setEditWsName] = useState("");
  const [savingWs, setSavingWs] = useState(false);
  const [deletingTargetWs, setDeletingTargetWs] = useState<Workspace | null>(null);
  const [deletingWs, setDeletingWs] = useState(false);
  const [editingProj, setEditingProj] = useState<Project | null>(null);
  const [editProjName, setEditProjName] = useState("");
  const [editProjDesc, setEditProjDesc] = useState("");
  const [savingProj, setSavingProj] = useState(false);
  const [deletingProj, setDeletingProj] = useState<Project | null>(null);
  const [deletingProjBusy, setDeletingProjBusy] = useState(false);
  const { toast } = useToast();

  const handleUpdateTargetProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProj || !editProjName.trim()) return;
    try {
      setSavingProj(true);
      const updated = await api.projects.update(editingProj.id, {
        name: editProjName.trim(),
        description: editProjDesc.trim(),
      });
      toast("Project updated", "success");
      setEditingProj(null);
      await refreshProjects();
      if (currentProject?.id === updated.id) {
        setCurrentProject(updated);
      }
    } catch (err: any) {
      toast(err.message || "Failed to update project", "error");
    } finally {
      setSavingProj(false);
    }
  };

  const handleDeleteTargetProject = async () => {
    if (!deletingProj) return;
    try {
      setDeletingProjBusy(true);
      await api.projects.delete(deletingProj.id);
      toast("Project deleted", "success");
      if (currentProject?.id === deletingProj.id) {
        setCurrentProject(null);
      }
      setDeletingProj(null);
      await refreshProjects();
    } catch (err: any) {
      toast(err.message || "Failed to delete project", "error");
    } finally {
      setDeletingProjBusy(false);
    }
  };

  const handleRenameTargetWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWs || !editWsName.trim()) return;
    try {
      setSavingWs(true);
      await api.workspaces.update(editingWs.id, { name: editWsName.trim() });
      toast("Workspace updated", "success");
      setEditingWs(null);
      await refreshWorkspaces();
    } catch (err: any) {
      toast(err.message || "Failed to update workspace", "error");
    } finally {
      setSavingWs(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!deletingTargetWs) return;
    try {
      setDeletingWs(true);
      await api.workspaces.delete(deletingTargetWs.id);
      toast("Workspace deleted", "success");
      setDeletingTargetWs(null);
      await refreshWorkspaces();
    } catch (err: any) {
      toast(err.message || "Failed to delete workspace", "error");
    } finally {
      setDeletingWs(false);
    }
  };

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !workspaceName.trim()) return;

    try {
      setIsLoading(true);
      await api.workspaces.update(currentWorkspace.id, { name: workspaceName.trim() });
      toast("Workspace updated successfully!", "success");
      refreshWorkspaces();
    } catch (err: any) {
      toast(err.message || "Failed to update workspace", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const canManage = currentWorkspace?.role === "Owner" || currentWorkspace?.role === "Admin";

  const available = sections.filter(({id}) =>
    (id !== "integrations" || canManage) && (id !== "organization" || currentWorkspace)
  );
  const requested = params.get("view") || (params.has("section") ? "organization" : "workspace");
  const active = available.find(item => item.id === requested)?.id || "workspace";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="page-header">
        <div>
          {currentWorkspace && <p className="mb-1 text-xs font-medium text-muted-foreground">{currentWorkspace.name}</p>}
          <h1 className="page-heading">Settings</h1>
        </div>
      </header>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-8">
        <nav aria-label="Settings sections" className="flex flex-wrap gap-1 border-b border-border pb-3 xl:sticky xl:top-0 xl:flex-col xl:self-start xl:border-b-0 xl:border-r xl:pr-3">
          {available.map(({id,label,icon: Icon}) => (
            <Link key={id} to={{search: "?view=" + id}} aria-current={active === id ? "page" : undefined}
              className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent-foreground">
              <Icon size={16} aria-hidden="true"/>{label}
            </Link>
          ))}
        </nav>
        <div className="settings-panels min-w-0">
          <section hidden={active !== "workspace"} aria-labelledby="workspace-settings-title" className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6 shadow-[var(--shadow-sm)]">
            <h2 id="workspace-settings-title" className="mb-5 text-lg font-semibold">Workspace profile</h2>
            {currentWorkspace ? <form onSubmit={handleUpdateWorkspace} className="space-y-5">
              <Input label="Workspace name" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} disabled={!canManage} required/>
              <Input label="Workspace URL slug" value={currentWorkspace.slug} readOnly helperText="Permanent identifier used in workspace URLs."/>
              {canManage && <div className="flex justify-end border-t border-border pt-4">
                <Button type="submit" isLoading={isLoading} disabled={!workspaceName.trim() || workspaceName.trim() === currentWorkspace.name}>Save changes</Button>
              </div>}
            </form> : <p>Select or create a workspace to edit its profile.</p>}
            {currentWorkspace && canManage && (
              <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-destructive">Delete workspace</h3>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete this workspace and all of its projects, issues, and settings.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeletingTargetWs(currentWorkspace)}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Delete workspace</span>
                </Button>
              </div>
            )}
          </section>
          {active === "workspace" && workspaces.length > 0 && (
            <section className="mt-4 rounded-2xl border border-border/75 bg-card p-5 sm:p-6 space-y-4 shadow-[var(--shadow-sm)]">
              <div>
                <h2 className="text-lg font-semibold">Manage workspaces</h2>
                <p className="text-xs text-muted-foreground">
                  Switch, rename, or delete each workspace individually.
                </p>
              </div>
              <div className="divide-y divide-border/60 rounded-xl border border-border/70">
                {workspaces.map((ws) => {
                  const isCurrent = ws.id === currentWorkspace?.id;
                  const canEditWs = ws.role === "Owner" || ws.role === "Admin";
                  return (
                    <div
                      key={ws.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {ws.name}
                          </span>
                          <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {ws.role}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          /{ws.slug}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!isCurrent && (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => setCurrentWorkspace(ws)}
                          >
                            Switch
                          </Button>
                        )}
                        {canEditWs && (
                          <>
                            <Button
                              type="button"
                              size="xs"
                              variant="secondary"
                              aria-label={`Edit workspace ${ws.name}`}
                              onClick={() => {
                                setEditingWs(ws);
                                setEditWsName(ws.name);
                              }}
                              className="gap-1"
                            >
                              <Pencil className="h-3 w-3" aria-hidden="true" />
                              <span>Edit</span>
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              aria-label={`Delete workspace ${ws.name}`}
                              onClick={() => setDeletingTargetWs(ws)}
                              className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                              <span>Delete</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <Modal
            isOpen={Boolean(editingWs)}
            onClose={() => setEditingWs(null)}
            title="Edit Workspace"
            description={editingWs ? `Update name for /${editingWs.slug}.` : undefined}
          >
            <form onSubmit={handleRenameTargetWorkspace} className="space-y-4">
              <Input
                label="Workspace name"
                value={editWsName}
                onChange={(e) => setEditWsName(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setEditingWs(null)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={savingWs}>
                  Save Changes
                </Button>
              </div>
            </form>
          </Modal>
          <ConfirmModal
            isOpen={Boolean(deletingTargetWs)}
            onClose={() => setDeletingTargetWs(null)}
            onConfirm={() => void handleDeleteWorkspace()}
            title="Delete Workspace"
            description={
              deletingTargetWs
                ? `Are you sure you want to delete "${deletingTargetWs.name}"? All projects, issues, and configuration history will be permanently removed.`
                : ""
            }
            confirmText="Delete Workspace"
            isLoading={deletingWs}
          />
          {active === "workspace" && currentWorkspace && (
            <section className="mt-4 rounded-2xl border border-border/75 bg-card p-5 sm:p-6 space-y-4 shadow-[var(--shadow-sm)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Manage projects</h2>
                  <p className="text-xs text-muted-foreground">
                    Select the active project, edit details, configure workflows, or delete projects in {currentWorkspace.name}.
                  </p>
                </div>
                <Link to="/projects" className="text-xs font-semibold text-primary hover:underline">
                  Open Projects page
                </Link>
              </div>
              {projects.length === 0 ? (
                <p className="text-xs text-muted-foreground">No projects in this workspace yet.</p>
              ) : (
                <div className="divide-y divide-border/60 rounded-xl border border-border/70">
                  {projects.map((proj) => {
                    const isActive = proj.id === currentProject?.id;
                    return (
                      <div
                        key={proj.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-4"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                              {proj.project_key}
                            </span>
                            <span className="font-semibold text-sm text-foreground">
                              {proj.name}
                            </span>
                            {isActive && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                Active
                              </span>
                            )}
                          </div>
                          {proj.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {proj.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!isActive && (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => setCurrentProject(proj)}
                            >
                              Set active
                            </Button>
                          )}
                          {canManage && (
                            <>
                              <Button
                                type="button"
                                size="xs"
                                variant="secondary"
                                aria-label={`Workflow for project ${proj.name}`}
                                onClick={() => {
                                  setCurrentProject(proj);
                                  navigate("/settings?view=workflow");
                                }}
                                className="gap-1"
                              >
                                <Workflow className="h-3 w-3" aria-hidden="true" />
                                <span>Workflow</span>
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="secondary"
                                aria-label={`Edit project ${proj.name}`}
                                onClick={() => {
                                  setEditingProj(proj);
                                  setEditProjName(proj.name);
                                  setEditProjDesc(proj.description ?? "");
                                }}
                                className="gap-1"
                              >
                                <Pencil className="h-3 w-3" aria-hidden="true" />
                                <span>Edit</span>
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                aria-label={`Delete project ${proj.name}`}
                                onClick={() => setDeletingProj(proj)}
                                className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                                <span>Delete</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          <Modal
            isOpen={Boolean(editingProj)}
            onClose={() => setEditingProj(null)}
            title="Edit Project"
            description={editingProj ? `Update settings for ${editingProj.project_key}.` : undefined}
          >
            <form onSubmit={handleUpdateTargetProject} className="space-y-4">
              <Input
                label="Project Name"
                value={editProjName}
                onChange={(e) => setEditProjName(e.target.value)}
                required
              />
              <Textarea
                label="Description"
                value={editProjDesc}
                onChange={(e) => setEditProjDesc(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setEditingProj(null)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={savingProj}>
                  Save Changes
                </Button>
              </div>
            </form>
          </Modal>
          <ConfirmModal
            isOpen={Boolean(deletingProj)}
            onClose={() => setDeletingProj(null)}
            onConfirm={() => void handleDeleteTargetProject()}
            title="Delete Project"
            description={
              deletingProj
                ? `Are you sure you want to delete "${deletingProj.name}" (${deletingProj.project_key})? All issues and workflow history in this project will be permanently removed.`
                : ""
            }
            confirmText="Delete Project"
            isLoading={deletingProjBusy}
          />
          <div hidden={active !== "organization"}><OrganizationSettings/></div>
          <div hidden={active !== "workflow"}><WorkflowSettings/></div>
          <div hidden={active !== "integrations"}><IntegrationSettings/></div>
          <div hidden={active !== "personal"} className="space-y-4">
            <section className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6 shadow-[var(--shadow-sm)]">
              <h2 className="mb-4 text-lg font-semibold">Your account</h2>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Name</dt><dd>{user?.name}</dd></div>
                <div><dt className="text-muted-foreground">Email</dt><dd className="break-words">{user?.email}</dd></div>
              </dl>
            </section>
            <PersonalSettings/>
          </div>
          <section hidden={active !== "system"} className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6 shadow-[var(--shadow-sm)]">
            <h2 className="mb-3 text-lg font-semibold">System information</h2>
            <dl className="divide-y divide-border text-sm">
              {[["Application version","0.1.0"],["Backend runtime","Rust (Axum + Tokio + SQLx)"],["Frontend stack","React 18 + Vite + Tailwind CSS"],["License","GNU AGPL-3.0"]].map(([label,value]) =>
                <div key={label} className="grid gap-1 py-3 sm:grid-cols-2"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>
              )}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
