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
      toast("Workspace created successfully!", "success");
    } catch (err: any) {
      toast(err.message || "Failed to create workspace", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="relative" {...disclosure.container}>
        <button
          {...disclosure.trigger}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full p-2.5 rounded-xl bg-secondary/50 hover:bg-accent text-left transition-colors border border-input hover:border-primary"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold truncate text-foreground">
                {currentWorkspace ? currentWorkspace.name : "Select Workspace"}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                {currentWorkspace?.role || "Free"}
              </div>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div {...disclosure.panel} className="dropdown-surface max-h-[55vh] overflow-y-auto absolute top-full left-0 right-0 mt-1.5 z-50 ">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                  className="flex items-center justify-between w-full min-h-9 px-2 py-1.5 text-sm rounded-md aria-[current=true]:bg-primary/10 hover:bg-accent transition-colors text-left"
                >
                  <span className="font-medium truncate">{ws.name}</span>
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
                className="flex items-center gap-2 w-full min-h-9 px-2 py-1.5 text-sm rounded-md hover:bg-accent text-primary font-medium transition-colors"
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
              if (!slug) {
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
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
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
