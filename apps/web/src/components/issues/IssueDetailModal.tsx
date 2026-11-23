import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description || "");
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

  if (!issue) return null;

  const handleUpdate = async (fields: {
    title?: string;
    description?: string;
    type?: IssueType;
    priority?: IssuePriority;
    status_id?: string;
    assignee_id?: string | null;
    sprint_id?: string | null;
    due_date?: string | null;
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
                className="w-full text-base font-semibold px-2 py-1 rounded border border-input bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                size="sm"
                onClick={() => {
                  handleUpdate({ title });
                  setIsEditingTitle(false);
                }}
              >
                Save
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
              Status
            </span>
            <select
              value={issue.status_id}
              onChange={(e) => handleUpdate({ status_id: e.target.value })}
              disabled={isUpdating}
              className="w-full h-8 rounded border border-input bg-background/60 px-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority selector */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              Priority
            </span>
            <select
              value={issue.priority}
              onChange={(e) => handleUpdate({ priority: e.target.value as IssuePriority })}
              disabled={isUpdating}
              className="w-full h-8 rounded border border-input bg-background/60 px-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="Lowest">Lowest</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          {/* Type selector */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              Type
            </span>
            <select
              value={issue.type}
              onChange={(e) => handleUpdate({ type: e.target.value as IssueType })}
              disabled={isUpdating}
              className="w-full h-8 rounded border border-input bg-background/60 px-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="Task">Task</option>
              <option value="Bug">Bug</option>
              <option value="Story">Story</option>
              <option value="Epic">Epic</option>
            </select>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Description
          </label>
          <div className="rounded-lg border border-border/60 bg-background/40 p-3 min-h-[90px] text-xs leading-relaxed text-foreground whitespace-pre-wrap">
            {description || <span className="text-muted-foreground italic">No description provided.</span>}
          </div>
        </div>

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
                  <p className="text-muted-foreground leading-normal whitespace-pre-wrap">{c.body}</p>
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
            <input
              type="text"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 h-9 rounded-md border border-input bg-background/50 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
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
