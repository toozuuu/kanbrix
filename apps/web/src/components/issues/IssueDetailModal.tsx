import { SelectBox } from "../ui/SelectBox";
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
import { Badge } from "../ui/Badge";
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
  onIssueUpdated: () => void;
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
  const {t}=useTranslation();
  const cfg=useIssueForm();
  const { labels: workspaceLabels } = useWorkspace();
  const [formKind,setFormKind]=useState<IssueType>("Task");
  const [values,setValues]=useState<Values>({});
  const [comments, setComments] = useState<Comment[]>([]);
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
      setSelectedLabels(issue.labels.map(l => l.id));
      loadComments(issue.id);
    }
  }, [issue]);

  const loadComments = async (issueId: string) => {
    try {
      const list = await api.comments.list(issueId);
      setComments(list);
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  };

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
      await api.issues.update(issue.id, fields);
      onIssueUpdated();
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
      onIssueUpdated();
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
    if (!window.confirm("Are you sure you want to delete this issue?")) return;

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
      description={`Created by ${issue.reporter_name} ${formatRelativeTime(issue.created_at)}`}
      maxWidth="xl"
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
                className="w-full text-base font-semibold px-2 py-1 rounded border border-input bg-card focus:outline-none focus:ring-1 focus:ring-primary"
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
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-base font-semibold text-foreground hover:bg-accent/50 p-1 rounded cursor-pointer transition-colors flex-1"
              title="Click to edit title"
            >
              {title}
            </h1>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Delete issue"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Metadata Controls Panel */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs">
          {/* Status selector */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              {t("Status")}
            </span>
            <SelectBox fullWidth compact
              aria-label={t("Status")}
              value={issue.status_id}
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
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              {t("Priority")}
            </span>
            <SelectBox fullWidth compact
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
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              {t("Type")}
            </span>
            <SelectBox fullWidth compact
              aria-label={t("Type")}
              value={formKind}
              onChange={(e) => setFormKind(e.target.value as IssueType)}
              disabled={isUpdating}
            >
              {Array.from(new Set([issue.type,...(cfg?.types??[])])).map(v=><option key={v}>{v}</option>)}
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

          {issue.labels.length > 0 ? (
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
              {workspaceLabels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {workspaceLabels.map((label) => (
                    <label key={label.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLabels.includes(label.id)}
                        onChange={() => handleToggleLabel(label.id)}
                        className="h-3.5 w-3.5 rounded border border-input text-primary focus:ring-primary/20"
                      />
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: label.color.startsWith('#') ? label.color : undefined,
                          borderColor: label.color.startsWith('#') ? label.color : '#d1d5db',
                          color: label.color.startsWith('#') ? 'white' : undefined,
                        }}
                        className="text-xs"
                      >
                        {label.name}
                      </Badge>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">No labels available in this workspace</p>
              )}
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
        {/* Description Section */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            {t("Description")}
          </label>
          {editingDescription ? <><MarkdownEditor label={t("Edit description")} value={description} onChange={setDescription}/>
            <Button size="sm" disabled={isUpdating} onClick={()=>handleUpdate({description})}>{t("Save description")}</Button>
            <Button size="sm" variant="ghost" onClick={()=>{setDescription(issue.description??"");editDescription(false);}}>{t("Cancel")}</Button></>
            : <><Markdown text={description || "No description provided."}/><button className="text-xs underline" onClick={()=>editDescription(true)}>{t("Edit description")}</button></>}
        </div>

        <Attachments issue={issue.id}/>
        {/* Discussion / Comments Section */}
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>Comments & Activity ({comments.length})</span>
          </div>

          {/* Comment list */}
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2.5 text-xs bg-secondary/20 p-2.5 rounded-lg border border-border/40">
                <Avatar name={c.author_name} size="sm" className="shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{c.author_name}</span>
                    <span className="text-[10px] text-muted-foreground">
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
          <form onSubmit={handleAddComment} className="flex gap-2 items-center">
            <MarkdownEditor label={t("Add a comment")} value={newComment} onChange={setNewComment}/>
            <Button size="sm" type="submit" isLoading={isSubmittingComment} className="gap-1">
              <Send className="h-3.5 w-3.5" />
              <span>Post</span>
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  );
}