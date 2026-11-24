import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Issue, IssueStatus } from "../../types";
import { IssueCard } from "./IssueCard";
import { cn } from "../../lib/utils";
import { Plus } from "lucide-react";

interface KanbanColumnProps {
  status: IssueStatus;
  issues: Issue[];
  loadMore?: () => void;
  onIssueClick: (issue: Issue) => void;
  onAddIssueToStatus: (statusId: string) => void;
}

export function KanbanColumn({
  status,
  issues, loadMore,
  onIssueClick,
  onAddIssueToStatus,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    data: { status },
  });

  const getStatusColor = (category: string) => {
    switch (category) {
      case "Backlog":
        return "bg-slate-400";
      case "Todo":
        return "bg-blue-500";
      case "InProgress":
        return "bg-amber-500";
      case "InReview":
        return "bg-purple-500";
      case "Done":
        return "bg-emerald-500";
      default:
        return "bg-muted-foreground";
    }
  };

  return (
    <section data-drop-active={isOver || undefined} ref={setNodeRef} aria-label={status.name} className={cn(
      "motion-board-column flex max-h-full w-[min(17rem,78vw)] shrink-0 flex-col rounded-[var(--card-radius)] border border-border/75 bg-secondary/45 shadow-[var(--shadow-sm)] transition-colors",
      isOver && "border-primary/50 bg-primary/5 ring-2 ring-primary/15",
    )}>
      {/* Column Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", getStatusColor(status.category))} />
          <h3 className="text-sm font-semibold text-foreground">
            {status.name}
          </h3>
          <span className="flex h-5 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">
            {issues.length}{loadMore ? "+" : ""}
          </span>
        </div>

      </div>

      {/* Issues Droppable Area */}
      <div className="min-h-3 flex-1 space-y-2 overflow-y-auto px-2 py-1">
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onClick={onIssueClick} />
          ))}
        </SortableContext>

        {loadMore && (
          <button type="button" onClick={loadMore} className="w-full py-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
            Load more issues
          </button>
        )}
      </div>
      <button type="button"
        onClick={() => onAddIssueToStatus(status.id)}
        aria-label={`Add issue to ${status.name}`}
        className="min-h-10 m-2 mt-1 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/80 bg-card/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:bg-card hover:text-primary"
      >
        <Plus size={14} aria-hidden="true" /> Add issue
      </button>
    </section>
  );
}
