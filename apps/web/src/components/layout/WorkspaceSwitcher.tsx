import { useDropdownDisclosure } from "../ui/useDropdownDisclosure";
import React, { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { ChevronDown, Plus, Check, Briefcase } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { useToast } from "../ui/Toast";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, setCurrentWorkspace, refreshWorkspaces } =
    useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const disclosure = useDropdownDisclosure(isOpen, setIsOpen);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slug, setSlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;

    try {
      setIsLoading(true);
      const ws = await api.workspaces.create({ name, slug });
      await refreshWorkspaces();
      setCurrentWorkspace(ws);
      setIsModalOpen(false);
      setName("");
      setSlug("");
      setSlugEdited(false);
      toast("Workspace created successfully!", "success");
    } catch (err: any) {
      toast(err.message || "Failed to create workspace", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="relative min-w-0" {...disclosure.container}>
        <button
          {...disclosure.trigger}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={currentWorkspace ? `Switch workspace, ${currentWorkspace.name}` : "Select workspace"}
          className="flex min-h-14 w-full items-center gap-2 rounded-md px-1 text-left transition-colors hover:bg-accent"
        >
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground font-serif text-xl text-background">
            {currentWorkspace?.name.trim().charAt(0).toLocaleUpperCase() || <Briefcase size={16}/>}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Workspace</span>
            <span className="block truncate text-sm font-semibold">{currentWorkspace?.name || "Select workspace"}</span>
          </span>
          <ChevronDown aria-hidden="true" size={15} className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}/>
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div {...disclosure.panel} className="dropdown-surface max-h-[55vh] overflow-y-auto absolute top-full left-0 w-56 max-w-[80vw] mt-1.5 z-50 ">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Workspaces
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  aria-current={currentWorkspace?.id === ws.id || undefined}
                  onClick={() => {
                    setCurrentWorkspace(ws);
                    disclosure.trigger.ref.current?.focus();
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-between w-full min-h-11 px-2 py-1.5 text-sm rounded-md aria-[current=true]:bg-primary/10 hover:bg-accent transition-colors text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{ws.name}</span>
                    {ws.role && <span className="block text-xs capitalize text-muted-foreground">{ws.role}</span>}
                  </span>
                  {currentWorkspace?.id === ws.id && (
                    <Check className="h-3.5 w-3.5 text-primary ml-2 shrink-0" />
                  )}
                </button>
              ))}

              <div className="my-1 border-t border-border" />
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 w-full min-h-11 px-2 py-1.5 text-sm rounded-md hover:bg-accent text-primary font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Workspace
              </button>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Workspace"
        description="Workspaces allow your team to collaborate on isolated projects and issues."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Workspace Name"
            placeholder="e.g. Acme Engineering"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) {
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "-")
                    .replace(/-+/g, "-")
                    .slice(0, 20)
                );
              }
            }}
            required
          />
          <Input
            label="Workspace URL Slug"
            placeholder="e.g. acme"
            value={slug}
            onChange={(e) => { setSlugEdited(true); setSlug(e.target.value.toLowerCase()); }}
            helperText="Used for identifiers and workspace routing"
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
