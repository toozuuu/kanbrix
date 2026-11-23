import React, { useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { useToast } from "../components/ui/Toast";
import { formatDate } from "../lib/utils";
import { FolderKanban, Plus, Layers, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ProjectsPage() {
  const { currentWorkspace, projects, currentProject, setCurrentProject, refreshProjects } =
    useWorkspace();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !name.trim() || !projectKey.trim()) return;

    try {
      setIsLoading(true);
      const newProj = await api.projects.create(currentWorkspace.id, {
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div>
          <h1 className="text-base font-bold text-foreground tracking-tight">Projects</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage projects inside the <span className="font-semibold text-foreground">{currentWorkspace?.name}</span> workspace.
          </p>
        </div>

        <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>New Project</span>
        </Button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((proj) => {
          const isSelected = currentProject?.id === proj.id;

          return (
            <div
              key={proj.id}
              onClick={() => {
                setCurrentProject(proj);
                navigate("/kanban");
              }}
              className={`p-5 rounded-xl border bg-card/60 hover:bg-accent/40 transition-all cursor-pointer space-y-3 relative group shadow-sm ${
                isSelected ? "border-primary ring-1 ring-primary/30" : "border-border/80"
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
                    <span className="text-[10px] text-muted-foreground">
                      Created {formatDate(proj.created_at)}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[32px]">
                {proj.description || <span className="italic">No description provided.</span>}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Layers className="h-3.5 w-3.5" />
                  {proj.issue_counter} total issues
                </span>
                <span className="text-primary font-medium flex items-center gap-1 text-[11px] group-hover:translate-x-0.5 transition-transform">
                  Open Board <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="col-span-full py-16 text-center space-y-3 border border-dashed border-border/60 rounded-xl">
            <FolderKanban className="h-10 w-10 text-muted-foreground/60 mx-auto" />
            <h3 className="text-sm font-semibold text-foreground">No Projects in Workspace</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Create your first project to begin tracking issues, sprints, and Kanban workflows.
            </p>
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
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
    </div>
  );
}
