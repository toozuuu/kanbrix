import { ProjectTemplateGallery, BUILTIN_TEMPLATES } from "../components/ProjectTemplateGallery";
import { ProjectSpinner } from "../components/ui/ProjectSpinner";
import { EmptyProjectIcon } from "../components/ui/ProjectEmptyState";
import { SelectBox } from "../components/ui/SelectBox";
import { useConfiguration } from "../context/useConfiguration";
import React, { useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { api, request } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { useToast } from "../components/ui/Toast";
import { useCalendar } from "./PersonalSettings";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Plus, Layers, ArrowRight, Pencil, Trash2, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Project } from "../types";

export function ProjectsPage() {
  const { currentWorkspace, projects, currentProject, setCurrentProject, refreshProjects, projectStatus, isLoading: loadingWorkspaces } =
    useWorkspace();
  const canManage = !!currentWorkspace && ["Owner", "Admin"].includes(currentWorkspace.role);
  const cfg=useConfiguration().data?.configuration;
  const [template,setTemplate]=useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const {display:formatDate}=useCalendar();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleEditOpen = (proj: Project) => {
    setEditingProject(proj);
    setEditName(proj.name);
    setEditDescription(proj.description ?? "");
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) return;
    try {
      setIsLoading(true);
      const updated = await api.projects.update(editingProject.id, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      toast("Project updated", "success");
      await refreshProjects();
      if (currentProject?.id === updated.id) {
        setCurrentProject(updated);
      }
      setEditingProject(null);
    } catch (err: any) {
      toast(err.message || "Failed to update project", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProject) return;
    try {
      setIsLoading(true);
      await api.projects.delete(deletingProject.id);
      toast("Project deleted", "success");
      if (currentProject?.id === deletingProject.id) {
        setCurrentProject(null);
      }
      await refreshProjects();
      setDeletingProject(null);
    } catch (err: any) {
      toast(err.message || "Failed to delete project", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !name.trim() || !projectKey.trim()) return;

    try {
      setIsLoading(true);
      const newProj = await api.projects.create(currentWorkspace.id, {
        template: template || undefined,
        name: name.trim(),
        project_key: projectKey.trim().toUpperCase(),
        description: description.trim() || undefined,
      });

      toast("Project created successfully!", "success");
      await refreshProjects();
      setCurrentProject(newProj);
      setIsModalOpen(false);
      setName("");
      setProjectKey("");
      setDescription("");
    } catch (err: any) {
      toast(err.message || "Failed to create project", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDemo = async () => {
    if (!currentWorkspace) return;
    try {
      setIsLoading(true);
      const res = await request<{ project_id: string; project_key: string; imported_count: number }>(
        `/workspaces/${currentWorkspace.id}/sync/seed-demo`,
        { method: "POST" },
      );
      toast(`Loaded sample project (${res.project_key}) with ${res.imported_count} issues`, "success");
      await refreshProjects();
      const seeded = await api.projects.get(res.project_id);
      setCurrentProject(seeded);
      navigate("/kanban");
    } catch (err: any) {
      toast(err.message || "Failed to load sample project", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 className="page-heading">Projects</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage projects inside the <span className="font-semibold text-foreground">{currentWorkspace?.name}</span> workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              disabled={!currentWorkspace || isLoading}
              onClick={() => void handleSeedDemo()}
            >
              Load sample project
            </Button>
          )}
          <Button size="sm" disabled={!currentWorkspace} onClick={() => setIsModalOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span>New Project</span>
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((proj) => {
          const isSelected = currentProject?.id === proj.id;

          return (
            <div
              key={proj.id}
              className={`motion-project-card p-5 rounded-2xl border bg-card hover:border-primary/40 hover:shadow-[var(--shadow-md)] transition-all cursor-pointer space-y-3 relative group shadow-[var(--shadow-sm)] ${
                isSelected ? "border-primary ring-1 ring-primary/30" : "border-border/75"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-mono font-bold text-xs">
                    {proj.project_key}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {proj.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      Created {formatDate(proj.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isSelected ? (
                    <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCurrentProject(proj)}
                      className="relative z-10 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      Set active
                    </button>
                  )}
                  {canManage && (
                    <div className="relative z-10 flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Manage workflow for ${proj.name}`}
                        title="Manage workflow"
                        onClick={() => {
                          setCurrentProject(proj);
                          navigate("/settings?view=workflow");
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit project ${proj.name}`}
                        title="Edit project"
                        onClick={() => handleEditOpen(proj)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete project ${proj.name}`}
                        title="Delete project"
                        onClick={() => setDeletingProject(proj)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[32px]">
                {proj.description || <span className="italic">No description provided.</span>}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono text-xs">
                  <Layers className="h-3.5 w-3.5" />
                  {proj.issue_counter} total issues
                </span>
                <button type="button" aria-label={`Open board for ${proj.name}`}
                  onClick={() => { setCurrentProject(proj); navigate("/kanban"); }}
                  className="text-primary font-medium flex items-center gap-1 text-xs after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
                  Open Board <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}

        {loadingWorkspaces && <ProjectSpinner size="sm" message="Loading workspaces."/>}
        {!loadingWorkspaces && !currentWorkspace && <p>Select or create a workspace to add projects.</p>}
        {currentWorkspace && projectStatus === "error" && <p role="alert">Could not load projects. <button className="underline" onClick={() => void refreshProjects()}>Retry</button></p>}
        {currentWorkspace && projectStatus === "loading" && <ProjectSpinner size="sm" message="Loading projects."/>}
        {currentWorkspace && projectStatus === "ready" && projects.length === 0 && (
          <div className="col-span-full py-16 text-center space-y-3 border border-dashed border-border/60 rounded-xl">
            <EmptyProjectIcon/>
            <h3 className="text-sm font-semibold text-foreground">No Projects in Workspace</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Create your first project to begin tracking issues, sprints, and Kanban workflows.
            </p>
            <Button size="sm" disabled={!currentWorkspace} onClick={() => setIsModalOpen(true)}>
              Create Project
            </Button>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Project"
        description="Projects define separate issue backlogs, workflows, and issue identifiers."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Project Name"
            placeholder="e.g. Core Platform"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!projectKey) {
                setProjectKey(
                  e.target.value
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 4)
                );
              }
            }}
            required
          />

          <Input
            label="Project Key (2-5 uppercase letters)"
            placeholder="e.g. CORE"
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
            helperText="Prefix for issue IDs, e.g. CORE-101"
            maxLength={6}
            required
          />

          <label className="block text-sm">Project template<SelectBox fullWidth value={template} onChange={e=>setTemplate(e.target.value)}><option value="">Organization default</option>{cfg?.templates.map(t=><option key={t.name} value={t.name}>{t.name}</option>)}{BUILTIN_TEMPLATES.filter(b => !cfg?.templates.some(t => t.name === b.name)).map(b => <option key={b.name} value={b.name}>{b.name}</option>)}</SelectBox></label>
          <Textarea
            label="Description (Optional)"
            placeholder="What is this project focused on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={Boolean(editingProject)}
        onClose={() => setEditingProject(null)}
        title="Edit Project"
        description={editingProject ? `Update settings for ${editingProject.project_key}.` : undefined}
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="Project Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setEditingProject(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(deletingProject)}
        onClose={() => setDeletingProject(null)}
        onConfirm={() => void handleDelete()}
        title="Delete Project"
        description={
          deletingProject
            ? `Are you sure you want to delete "${deletingProject.name}" (${deletingProject.project_key})? All issues and workflow history in this project will be permanently removed.`
            : ""
        }
        confirmText="Delete Project"
        isLoading={isLoading}
      />

      {currentWorkspace && (
        <ProjectTemplateGallery
          onSelectTemplate={(tpl) => {
            setTemplate(tpl);
            setIsModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
