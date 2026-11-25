import { ProjectLabelPicker, useProjectLabels } from "../issues/ProjectLabelPicker";
import { IssueRelationsPanel } from "./IssueRelationsPanel";
import { ConfirmAction } from "../ui/ActionDialogs";
import { SelectBox } from "../ui/SelectBox";
import { DateField } from "../ui/DateField";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import {useTranslation} from "react-i18next";
import {Attachments} from "./Attachments";
import {Markdown,MarkdownEditor} from "../MarkdownEditor";
import React, { useState, useEffect } from "react";
import { useIssueForm } from "../../context/useIssueForm";
import { useWorkspace } from "../../context/WorkspaceContext";
import { CustomFields } from "../CustomFields";
import type { Values } from "../../types/configuration";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { LabelBadge } from "../ui/LabelBadge";
import { Issue, Comment, IssueStatus, IssuePriority, IssueType } from "../../types";
import { api } from "../../lib/api";
import { useToast } from "../ui/Toast";
import { formatRelativeTime } from "../../lib/utils";
import { Trash2, Send, MessageSquare } from "lucide-react";

interface IssueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue: Issue | null;
  statuses: IssueStatus[];
  onIssueUpdated: (issue: Issue) => void;
  onIssueDeleted: () => void;
}

export function IssueDetailModal({
  isOpen,
  onClose,
  issue,
  statuses,
  onIssueUpdated,
  onIssueDeleted,
}: IssueDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {t}=useTranslation();
  const cfg=useIssueForm();
  const { currentWorkspace } = useWorkspace();
  const { data: workspaceLabels = [] } = useProjectLabels(isOpen);
  const { user } = useAuth();
  const projectId = issue?.project_id;
  const workspaceId = currentWorkspace?.id;
  const sprints = useQuery({
    queryKey: ["project-sprints", projectId],
    queryFn: () => api.sprints.list(projectId!),
    enabled: isOpen && !!projectId,
  });
  const members = useQuery({
    queryKey: ["issue-assignees", workspaceId],
    queryFn: () => api.workspaces.members(workspaceId!),
    enabled: isOpen && !!workspaceId,
  });
  const [formKind,setFormKind]=useState<IssueType>("Task");
  const [values,setValues]=useState<Values>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [activityView, setActivityView] = useState<"comments" | "history">("comments");
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [editingDescription,editDescription]=useState(false);
  const [description, setDescription] = useState("");
  const [isEditingLabels, setIsEditingLabels] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (issue) {
      setFormKind(issue.type);
      setValues(issue.custom_values??{});
      setTitle(issue.title);
      editDescription(false);
      setDescription(issue.description || "");
      setSelectedLabels((issue.labels ?? []).map(l => l.id));
    }
  }, [issue]);

  const issueId = issue?.id;
  const history = useQuery({
    queryKey: ["issue-history", workspaceId, issueId],
    queryFn: () => api.workspaces.activity(workspaceId!, issueId!),
    enabled: isOpen && !!workspaceId && !!issueId && activityView === "history",
  });
  const historyEntries = history.data?.filter(entry => entry.entity_type === "issue" && entry.entity_id === issueId);
  useEffect(() => {
    setComments([]);
    setNewComment("");
    setActivityView("comments");
    if (!isOpen || !issueId) return;
    let active = true;
    api.comments.list(issueId).then(list => {
      if (active) setComments(list);
    }).catch(error => {
      if (active) console.error("Failed to load comments", error);
    });
    return () => { active = false; };
  }, [isOpen, issueId]);

  const handleToggleLabel = (labelId: string) => {
    setSelectedLabels(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  if (!issue) return null;

  const handleUpdate = async (fields: {
    custom_values?:Values;
    title?: string;
    description?: string;
    type?: IssueType;
    priority?: IssuePriority;
    status_id?: string;
    assignee_id?: string | null;
    sprint_id?: string | null;
    due_date?: string | null;
    labels?: string[];
  }) => {
    try {
      setIsUpdating(true);
      const updated = await api.issues.update(issue.id, fields);
      onIssueUpdated(updated);
      if (activityView === "history") void history.refetch();
      toast("Issue updated", "success");
    } catch (err: any) {
      toast(err.message || "Failed to update issue", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveLabels = async () => {
    try {
      setIsUpdating(true);
      await api.issueLabels.set(issue.id, selectedLabels);
      onIssueUpdated({ ...issue, labels: workspaceLabels.filter(label => selectedLabels.includes(label.id)) });
      setIsEditingLabels(false);
      toast("Labels updated", "success");
    } catch (err: any) {
      toast(err.message || "Failed to update labels", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setIsSubmittingComment(true);
      const created = await api.comments.create(issue.id, { body: newComment.trim() });
      setComments((prev) => [...prev, created]);
      setNewComment("");
      toast("Comment posted", "success");
    } catch (err: any) {
      toast(err.message || "Failed to post comment", "error");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);

    try {
      await api.issues.delete(issue.id);
      toast("Issue deleted", "success");
      onIssueDeleted();
      onClose();
    } catch (err: any) {
      toast(err.message || "Failed to delete issue", "error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={issue.identifier}
      description={issue.project_key}
      maxWidth="issue"
    >
      <div className="space-y-6">
        {/* Title editing */}
        <div className="flex items-start justify-between gap-4">
          {isEditingTitle ? (
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-base font-semibold px-2 py-1 rounded border border-input bg-card "
              />
              <Button
                size="sm"
                onClick={() => {
                  handleUpdate({ title });
                  setIsEditingTitle(false);
                }}
              >
                {t("Save")}
              </Button>
            </div>
          ) : (
            <button type="button"
              onClick={() => setIsEditingTitle(true)}
              className="text-xl font-semibold text-foreground hover:bg-accent/50 p-1 rounded transition-colors flex-1 text-start break-words min-w-0"
              title="Click to edit title"
            >
              {title}
            </button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Delete issue"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
          <div className="min-w-0 space-y-6">
            {/* Description Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{t("Description")}</h3>
              {editingDescription ? <><MarkdownEditor label={t("Edit description")} value={description} onChange={setDescription}/>
                <Button size="sm" disabled={isUpdating} onClick={()=>handleUpdate({description})}>{t("Save description")}</Button>
                <Button size="sm" variant="ghost" onClick={()=>{setDescription(issue.description??"");editDescription(false);}}>{t("Cancel")}</Button></>
                : <><Markdown text={description || "No description provided."}/><button className="text-xs underline" onClick={()=>editDescription(true)}>{t("Edit description")}</button></>}
            </div>

            <Attachments issue={issue.id}/>
            <IssueRelationsPanel issue={issue} statuses={statuses} onChanged={() => onIssueUpdated(issue)} />
            {/* Discussion / Comments Section */}
            <div className="space-y-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span>Activity</span>
              </div>

              <div className="flex gap-2" role="group" aria-label="Issue activity view">
                <Button type="button" size="sm" variant={activityView === "comments" ? "default" : "outline"}
                  aria-pressed={activityView === "comments"} onClick={() => setActivityView("comments")}>
                  Comments ({comments.length})
                </Button>
                <Button type="button" size="sm" variant={activityView === "history" ? "default" : "outline"}
                  aria-pressed={activityView === "history"} onClick={() => setActivityView("history")}>
                  History
                </Button>
              </div>
              {activityView === "comments" ? <>
                {/* Comment list */}
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2.5 text-xs bg-secondary/20 p-2.5 rounded-lg border border-border/40">
                      <Avatar name={c.author_name} size="sm" className="shrink-0 mt-0.5" />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{c.author_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(c.created_at)}
                          </span>
                        </div>
                        <Markdown text={c.body}/>
                      </div>
                    </div>
                  ))}

                  {comments.length === 0 && (
                    <div className="py-4 text-center text-xs text-muted-foreground/60 italic">
                      No comments yet. Start the conversation!
                    </div>
                  )}
                </div>

                {/* Add comment input */}
                <form onSubmit={handleAddComment} className="flex flex-col items-start gap-2">
                  <MarkdownEditor className="w-full" label={t("Add a comment")} value={newComment} onChange={setNewComment}/>
                  <Button size="sm" type="submit" isLoading={isSubmittingComment} className="gap-1">
                    <Send className="h-3.5 w-3.5" />
                    <span>Post</span>
                  </Button>
                </form>
              </> : (
                <div className="space-y-2 text-sm" aria-live="polite">
                  {history.isPending && <p>Loading issue historyÃ¢â‚¬Â¦</p>}
                  {history.isError && <button type="button" className="text-primary underline" onClick={() => void history.refetch()}>Retry history</button>}
                  {historyEntries?.length === 0 && <p className="text-muted-foreground">No recorded changes.</p>}
                  {historyEntries?.map(entry => (
                    <div key={entry.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border p-2">
                      <span>{entry.actor_name ?? "System"} Ã‚Â· {entry.action}</span>
                      <span className="text-muted-foreground">{formatRelativeTime(entry.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <aside aria-label="Issue details" className="min-w-0 space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
            <h3 className="text-sm font-semibold">Issue details</h3>
            {/* Metadata Controls Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 text-xs">
              {/* Status selector */}
              <div className="space-y-1">
                <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                  {t("Status")}
                </span>
                <SelectBox fullWidth
                  aria-label={t("Status")}
                  value={issue.status_id}
                  unavailableLabel={issue.status_name}
                  onChange={(e) => handleUpdate({ status_id: e.target.value })}
                  disabled={isUpdating}
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </SelectBox>
              </div>

              {/* Priority selector */}
              <div className="space-y-1">
                <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                  {t("Priority")}
                </span>
                <SelectBox fullWidth
                  aria-label={t("Priority")}
                  value={issue.priority}
                  onChange={(e) => handleUpdate({ priority: e.target.value as IssuePriority })}
                  disabled={isUpdating}
                >
                  {Array.from(new Set([issue.priority,...(cfg?.priorities??[])])).map(v=><option key={v}>{v}</option>)}
                </SelectBox>
              </div>

              {/* Type selector */}
              <div className="space-y-1">
                <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                  {t("Type")}
                </span>
                <SelectBox fullWidth
                  aria-label={t("Type")}
                  value={formKind}
                  onChange={(e) => setFormKind(e.target.value as IssueType)}
                  disabled={isUpdating}
                >
                  {Array.from(new Set([issue.type, formKind, ...(cfg?.types ?? [])])).map(value => <option key={value} value={value}>{value}</option>)}
                </SelectBox>
              </div>
            </div>

            {/* Labels Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  {t("Labels")}
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingLabels(!isEditingLabels)}
                  className="text-xs h-6 px-2"
                >
                  {isEditingLabels ? "Done" : "Edit"}
                </Button>
              </div>

              {!!issue.labels?.length ? (
                <div className="flex flex-wrap gap-2">
                  {issue.labels.map((label) => (
                    <LabelBadge key={label.id} label={label} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">No labels</p>
              )}

              {/* Label selection when editing */}
              {isEditingLabels && (
                <div className="mt-2 p-3 rounded-lg border border-border bg-secondary/40">
                  <ProjectLabelPicker selected={selectedLabels} toggle={handleToggleLabel} add={id => setSelectedLabels(prev => prev.includes(id) ? prev : [...prev,id])}/>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={handleSaveLabels}
                    disabled={isUpdating}
                  >
                    Save Labels
                  </Button>
                </div>
              )}
            </div>

            {Object.entries(issue.custom_values??{}).some(([id])=>cfg && !cfg.fields.some(f=>f.id===id)) && <details><summary>Archived field values</summary>{Object.entries(issue.custom_values??{}).filter(([id])=>!cfg?.fields.some(f=>f.id===id)).map(([id,value])=><p key={id} className="text-sm">{id}: {String(value??"")}</p>)}</details>}
            {(!!cfg?.fields.length || formKind!==issue.type) && <form className="space-y-3" onSubmit={e=>{e.preventDefault();void handleUpdate({type:formKind,custom_values:values});}}>
              <CustomFields fields={cfg?.fields??[]} kind={formKind} values={values} change={setValues}/>
              <Button size="sm" disabled={isUpdating}>Save issue form</Button>
            </form>}
            <div className="space-y-3 border-t border-border pt-3">
              <label className="block space-y-1 text-xs font-medium">
                Assignee
                <SelectBox fullWidth value={issue.assignee_id ?? ""} unavailableLabel={issue.assignee_name ?? "Current assignee"}
                  disabled={isUpdating || members.isPending || members.isError}
                  onChange={event => void handleUpdate({ assignee_id: event.target.value || null })}>
                  <option value="">{members.isPending ? "Loading assigneesÃ¢â‚¬Â¦" : "Unassigned"}</option>
                  {members.data?.map(member => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}
                </SelectBox>
              </label>
              {user && issue.assignee_id !== user.id && (
                <button type="button" disabled={isUpdating} className="text-xs text-primary underline"
                  onClick={() => void handleUpdate({ assignee_id: user.id })}>Assign to me</button>
              )}
              {members.isError && <button type="button" className="block text-xs text-primary underline" onClick={() => void members.refetch()}>Retry assignees</button>}
              <label className="block space-y-1 text-xs font-medium">
                Sprint
                <SelectBox fullWidth value={issue.sprint_id ?? ""} unavailableLabel="Current sprint"
                  disabled={isUpdating || sprints.isPending || sprints.isError}
                  onChange={event => void handleUpdate({ sprint_id: event.target.value || null })}>
                  <option value="">{sprints.isPending ? "Loading sprintsÃ¢â‚¬Â¦" : "No sprint"}</option>
                  {sprints.data?.filter(sprint => sprint.status !== "completed" || sprint.id === issue.sprint_id)
                    .map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
                </SelectBox>
              </label>
              {sprints.isError && <button type="button" className="text-xs text-primary underline" onClick={() => void sprints.refetch()}>Retry sprints</button>}
              <DateField label="Due date" value={issue.due_date?.slice(0, 10) ?? ""}
                onChange={date => {
                  if (!isUpdating) void handleUpdate({ due_date: date ? date + "T00:00:00Z" : null });
                }}/>
              <dl className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <dt className="text-muted-foreground">Reporter</dt>
                <dd>{issue.reporter_name}</dd>
              </dl>
            </div>
            <p className="text-xs text-muted-foreground">Created {formatRelativeTime(issue.created_at)}</p>
          </aside>
        </div>
      </div>
      {confirmDelete && <ConfirmAction title="Delete issue?" description={`�${issue.title}� will be permanently deleted.`} action="Delete issue" onCancel={() => setConfirmDelete(false)} onConfirm={handleDelete} />}
    </Modal>
  );
}
