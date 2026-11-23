import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { useWorkspace } from "../../context/WorkspaceContext";
import { api } from "../../lib/api";
import { IssueStatus, IssueType, IssuePriority } from "../../types";
import { useToast } from "../ui/Toast";

interface NewIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  statuses: IssueStatus[];
  initialStatusId?: string;
  onSuccess: () => void;
}

export function NewIssueModal({
  isOpen,
  onClose,
  statuses,
  initialStatusId,
  onSuccess,
}: NewIssueModalProps) {
  const { currentProject } = useWorkspace();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<IssueType>("Task");
  const [priority, setPriority] = useState<IssuePriority>("Medium");
  const [statusId, setStatusId] = useState(
    initialStatusId || statuses[0]?.id || ""
  );
  const [dueDate, setDueDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (initialStatusId) {
      setStatusId(initialStatusId);
    } else if (statuses.length > 0 && !statusId) {
      setStatusId(statuses[0].id);
    }
  }, [initialStatusId, statuses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !title.trim() || !statusId) return;

    try {
      setIsLoading(true);
      await api.issues.create(currentProject.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        status_id: statusId,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      });

      toast("Issue created successfully!", "success");
      setTitle("");
      setDescription("");
      setDueDate("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err.message || "Failed to create issue", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Issue"
      description={`Project: ${currentProject?.name} (${currentProject?.project_key})`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground/80 tracking-wide">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as IssueType)}
              className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="Task">Task</option>
              <option value="Bug">Bug</option>
              <option value="Story">Story</option>
              <option value="Epic">Epic</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground/80 tracking-wide">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as IssuePriority)}
              className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="Lowest">Lowest</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground/80 tracking-wide">
              Status
            </label>
            <select
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            type="date"
            label="Due Date (Optional)"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <Textarea
          label="Description (Optional)"
          placeholder="Provide context, acceptance criteria, reproduction steps..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Create Issue
          </Button>
        </div>
      </form>
    </Modal>
  );
}
