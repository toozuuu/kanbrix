import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { useWorkspace } from "../../context/WorkspaceContext";
import { api } from "../../lib/api";
import { useToast } from "../ui/Toast";

interface NewSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewSprintModal({ isOpen, onClose, onSuccess }: NewSprintModalProps) {
  const { currentProject } = useWorkspace();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !name.trim()) return;

    try {
      setIsLoading(true);
      await api.sprints.create(currentProject.id, {
        name: name.trim(),
        goal: goal.trim() || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
      });

      toast("Sprint created successfully!", "success");
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err.message || "Failed to create sprint", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Planned Sprint"
      description={`Project: ${currentProject?.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Sprint Name"
          placeholder="e.g. Sprint 2 - Core Services"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="Sprint Goal (Optional)"
          placeholder="What is the primary objective of this sprint?"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            type="date"
            label="Start Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="date"
            label="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Create Sprint
          </Button>
        </div>
      </form>
    </Modal>
  );
}
