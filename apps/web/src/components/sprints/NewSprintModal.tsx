import { DateField } from "../ui/DateField";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { useWorkspace } from "../../context/WorkspaceContext";
import { api } from "../../lib/api";
import { useToast } from "../ui/Toast";

interface NewSprintModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function NewSprintModal({ onClose, onSuccess }: NewSprintModalProps) {
  const { currentProject } = useWorkspace();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const sprintName = name.trim();
  const nameLength = [...sprintName].length;
  const invalidName = nameLength < 2 || nameLength > 100;
  const dateError = startDate && endDate && endDate < startDate
    ? "End date must be on or after the start date."
    : undefined;

  useEffect(() => { nameInput.current?.focus(); }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading || !currentProject) return;
    setSubmitted(true);
    setSubmitError("");
    if (invalidName || dateError) return;

    setIsLoading(true);
    try {
      await api.sprints.create(currentProject.id, {
        name: sprintName,
        goal: goal.trim() || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create sprint");
      return;
    } finally {
      setIsLoading(false);
    }

    toast("Sprint created successfully!", "success");
    onSuccess();
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={() => { if (!isLoading) onClose(); }}
      title="Create Planned Sprint"
      description={currentProject?.name}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset disabled={isLoading} className="min-w-0 space-y-5">
          <Input
            ref={nameInput}
            label="Sprint name"
            placeholder="e.g. Sprint 2 – Core Services"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={submitted && invalidName ? "Enter a sprint name between 2 and 100 characters." : undefined}
            required
          />

          <Textarea
            label="Sprint goal (optional)"
            placeholder="What should this sprint accomplish?"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
          />

          <fieldset className="min-w-0 rounded-xl border border-border p-3">
            <legend className="px-1 text-xs font-semibold">Schedule (optional)</legend>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <DateField label="Start date" value={startDate} onChange={setStartDate} calendarInFlow />
              <DateField label="End date" value={endDate} onChange={setEndDate} error={dateError} calendarInFlow />
            </div>
          </fieldset>
        </fieldset>

        {submitError && <p role="alert" className="text-sm text-destructive break-words">{submitError}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border/50 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isLoading ? "Creating sprint…" : "Create Sprint"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
