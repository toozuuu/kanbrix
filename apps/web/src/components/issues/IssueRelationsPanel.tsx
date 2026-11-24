import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Link2, Plus, X } from "lucide-react";
import { api } from "../../lib/api";
import { Issue, IssueStatus } from "../../types";
import { Button } from "../ui/Button";
import { SelectBox } from "../ui/SelectBox";
import { useToast } from "../ui/Toast";

export function IssueRelationsPanel({
  issue,
  statuses,
  onChanged,
}: {
  issue: Issue;
  statuses: IssueStatus[];
  onChanged: () => void;
}) {
  const client = useQueryClient();
  const { toast } = useToast();
  const relations = useQuery({
    queryKey: ["issue-relations", issue.id],
    queryFn: () => api.issues.relations(issue.id),
  });

  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkType, setLinkType] = useState("relates_to");
  const [addingLink, setAddingLink] = useState(false);

  const defaultStatusId = statuses[0]?.id ?? issue.status_id;

  async function handleAddSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!subtaskTitle.trim()) return;
    setAddingSubtask(true);
    try {
      await api.issues.create(issue.project_id, {
        title: subtaskTitle.trim(),
        type: "Task",
        priority: "Medium",
        status_id: defaultStatusId,
        parent_issue_id: issue.id,
      });
      setSubtaskTitle("");
      await client.invalidateQueries({ queryKey: ["issue-relations", issue.id] });
      onChanged();
      toast("Subtask created", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create subtask", "error");
    } finally {
      setAddingSubtask(false);
    }
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkTarget.trim()) return;
    setAddingLink(true);
    try {
      await api.issues.addLink(issue.id, {
        target_identifier: linkTarget.trim(),
        link_type: linkType,
      });
      setLinkTarget("");
      await client.invalidateQueries({ queryKey: ["issue-relations", issue.id] });
      toast("Issue linked", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to link issue", "error");
    } finally {
      setAddingLink(false);
    }
  }

  async function handleRemoveLink(linkId: string) {
    try {
      await api.issues.removeLink(issue.id, linkId);
      await client.invalidateQueries({ queryKey: ["issue-relations", issue.id] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove link", "error");
    }
  }

  const subtasks = relations.data?.subtasks ?? [];
  const links = relations.data?.links ?? [];

  return (
    <div className="space-y-4 pt-2 border-t border-border/60">
      {/* Subtasks */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <GitBranch className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>Subtasks ({subtasks.length})</span>
        </div>
        {subtasks.length > 0 && (
          <ul className="space-y-1">
            {subtasks.map((st) => (
              <li
                key={st.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/20 px-2.5 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-primary shrink-0">{st.identifier}</span>
                  <span className="truncate font-medium">{st.title}</span>
                </div>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground shrink-0">
                  {st.status_name}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(e) => void handleAddSubtask(e)} className="flex gap-1.5">
          <input
            aria-label="New subtask title"
            placeholder="Add subtask…"
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-2.5 text-xs"
          />
          <Button type="submit" size="xs" variant="secondary" isLoading={addingSubtask} className="gap-1 h-9">
            <Plus className="h-3 w-3" aria-hidden="true" />
            <span>Add</span>
          </Button>
        </form>
      </div>

      {/* Linked Issues */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Link2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>Linked Issues ({links.length})</span>
        </div>
        {links.length > 0 && (
          <ul className="space-y-1">
            {links.map((lk) => (
              <li
                key={lk.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/20 px-2.5 py-1.5 text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground shrink-0">
                    {lk.link_type.replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-primary shrink-0">{lk.identifier}</span>
                  <span className="truncate font-medium">{lk.title}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Remove link to ${lk.identifier}`}
                  onClick={() => void handleRemoveLink(lk.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(e) => void handleAddLink(e)} className="flex flex-wrap gap-1.5">
          <SelectBox
            aria-label="Link type"
            value={linkType}
            onChange={(e) => setLinkType(e.target.value)}
          >
            <option value="relates_to">relates to</option>
            <option value="blocks">blocks</option>
            <option value="is_blocked_by">is blocked by</option>
            <option value="duplicates">duplicates</option>
          </SelectBox>
          <input
            aria-label="Target issue key"
            placeholder="e.g. CORE-12"
            value={linkTarget}
            onChange={(e) => setLinkTarget(e.target.value.toUpperCase())}
            className="h-9 min-w-[7rem] flex-1 rounded-lg border border-input bg-card px-2.5 text-xs font-mono"
          />
          <Button type="submit" size="xs" variant="secondary" isLoading={addingLink} className="h-9">
            Link
          </Button>
        </form>
      </div>
    </div>
  );
}
