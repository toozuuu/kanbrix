import { ProjectLabelPicker } from "../issues/ProjectLabelPicker";
import { SelectBox } from "../ui/SelectBox";
import {useTranslation} from "react-i18next";
import { useIssueForm } from "../../context/useIssueForm";
import { useConfiguration } from "../../context/useConfiguration";
import { CustomFields } from "../CustomFields";
import type { Values } from "../../types/configuration";
import { DateField } from "../ui/DateField";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FolderKanban, SlidersHorizontal } from "lucide-react";
import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { MarkdownEditor } from "../MarkdownEditor";
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
  statuses: suppliedStatuses,
  initialStatusId,
  onSuccess,
}: NewIssueModalProps) {
  const {t}=useTranslation();
  const cfg=useIssueForm();
  const configuration = useConfiguration();
  const [values,setValues]=useState<Values>({});
  const { currentProject } = useWorkspace();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("Task");
  const [priority, setPriority] = useState<IssuePriority>("Medium");
  const [storyPoints, setStoryPoints] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const workflow = useQuery({
    queryKey: ["project-workflow", currentProject?.id],
    queryFn: () => api.projects.get(currentProject!.id),
    enabled: isOpen && !!currentProject && !suppliedStatuses.length,
  });
  const statuses = suppliedStatuses.length ? suppliedStatuses : workflow.data?.statuses ?? [];
  const [chosenStatus, setStatusId] = useState("");
  const statusId = [chosenStatus, initialStatusId, statuses[0]?.id]
    .find(id => statuses.some(status => status.id === id)) ?? "";
  const [dueDate, setDueDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const issueType = cfg?.types.includes(type) ? type : cfg?.types[0] ?? "";
  const issuePriority = cfg?.priorities.includes(priority) ? priority : cfg?.priorities[0] ?? "";
  const canSubmit = Boolean(issueType && issuePriority && statusId && title.trim().length >= 2);

  React.useEffect(() => {
    setValues({});
    setStatusId("");
    setSelectedLabels([]);
  }, [isOpen, currentProject?.id, initialStatusId]);

  const handleToggleLabel = (labelId: string) => {
    setSelectedLabels(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfg || !currentProject || !canSubmit || isLoading) return;

    try {
      setIsLoading(true);
      await api.issues.create(currentProject.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        type: issueType,
        priority: issuePriority,
        custom_values: Object.fromEntries(Object.entries(values).filter(([id]) =>
          cfg.fields.some(field => field.id === id && (!field.issue_type || field.issue_type === issueType)),
        )),
        status_id: statusId,
        story_points: storyPoints ? Number(storyPoints) : undefined,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        labels: selectedLabels.length > 0 ? selectedLabels : undefined,
      });

      toast("Issue created successfully!", "success");
      setTitle("");
      setDescription("");
      setDueDate("");
      setStoryPoints("");
      setSelectedLabels([]);
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
      title={t("Create issue")}
      maxWidth="2xl"
    >
      {!currentProject ? (
        <div className="space-y-4 rounded-lg border border-border bg-secondary/50 p-5">
          <FolderKanban className="text-primary" />
          <p className="text-sm">Choose or create a project before adding an issue.</p>
          <Link to="/projects" onClick={onClose} className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">View projects</Link>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><FolderKanban size={18} /></span>
          <div><p className="text-xs text-muted-foreground">{t("Project")}</p><p className="text-sm font-semibold">{currentProject.name} <span className="ml-1 font-mono text-xs text-muted-foreground">{currentProject.project_key}</span></p></div>
        </div>
        <Input
          label={t("Summary")}
          minLength={2}
          maxLength={255}
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <MarkdownEditor label={t("Description (optional)")} value={description} onChange={setDescription} defaultMode="rich"/>

        <fieldset className="space-y-3 rounded-lg border border-border bg-secondary/40 px-4 pb-4">
          <legend className="px-1 text-sm font-semibold"><SlidersHorizontal size={14} className="mr-2 inline text-primary" />{t("Issue details")}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="new-issue-type" className="block text-xs font-semibold text-foreground/80 tracking-wide">
              {t("Type")}
            </label>
            <SelectBox fullWidth
              id="new-issue-type"
              value={issueType}
              disabled={!issueType}
              onChange={(e) => setType(e.target.value as IssueType)}
            >
              {!issueType && <option value="">{configuration.isFetching ? "Loading types…" : "Types unavailable"}</option>}
              {cfg?.types.map(value => <option key={value} value={value}>{value}</option>)}
            </SelectBox>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-issue-priority" className="block text-xs font-semibold text-foreground/80 tracking-wide">
              {t("Priority")}
            </label>
            <SelectBox fullWidth
              id="new-issue-priority"
              value={issuePriority}
              disabled={!issuePriority}
              onChange={(e) => setPriority(e.target.value as IssuePriority)}
            >
              {!issuePriority && <option value="">{configuration.isFetching ? "Loading priorities…" : "Priorities unavailable"}</option>}
              {cfg?.priorities.map(value => <option key={value} value={value}>{value}</option>)}
            </SelectBox>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="new-issue-statusId" className="block text-xs font-semibold text-foreground/80 tracking-wide">
              {t("Status")}
            </label>
            <SelectBox fullWidth
              id="new-issue-statusId"
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              required
            >
              {!statuses.length && <option value="">{workflow.isFetching ? "Loading statuses" : "No statuses available"}</option>}
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectBox>
          </div>

          <DateField
            label="Due date (optional)"
            value={dueDate}
            onChange={setDueDate}
          />
        </div>

        <Input
          label="Story points (optional)"
          type="number"
          min={0}
          max={100}
          placeholder="e.g. 3"
          value={storyPoints}
          onChange={(e) => setStoryPoints(e.target.value)}
        />

        {/* Labels selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground tracking-wide block">
            {t("Labels", "Labels")}
          </label>
          <ProjectLabelPicker selected={selectedLabels} toggle={handleToggleLabel} add={id => setSelectedLabels(prev => prev.includes(id) ? prev : [...prev,id])}/>
        </div>

        </fieldset>
        <CustomFields fields={cfg?.fields ?? []} kind={issueType} values={values} change={setValues}/>
        {cfg?.usesBuiltInOptions && (
          <p className="text-xs text-muted-foreground">Using built-in issue options. Update the API to use workspace-specific fields.</p>
        )}
        {(!issueType || !issuePriority) && !configuration.isFetching && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
            <p role="status">Issue settings are unavailable. Reload them to create an issue.</p>
            <button type="button" onClick={() => void configuration.refetch()} className="font-medium text-primary underline">
              Retry
            </button>
          </div>
        )}
        {workflow.isError && !statuses.length && <button type="button" onClick={() => workflow.refetch()} className="text-sm text-primary underline">Retry loading statuses</button>}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={!canSubmit} isLoading={isLoading}>
            {t("Create Issue")}
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );
}
