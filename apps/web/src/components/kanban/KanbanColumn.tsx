import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Issue, IssueStatus } from "../../types";
import { IssueCard } from "./IssueCard";
import { cn } from "../../lib/utils";
import { Plus } from "lucide-react";

interface KanbanColumnProps {
  status: IssueStatus;
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
  onAddIssueToStatus: (statusId: string) => void;
}

export function KanbanColumn({
  status,
  issues,
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
    <div className="flex flex-col w-80 shrink-0 rounded-xl bg-secondary/30 border border-border/50 max-h-full">
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", getStatusColor(status.category))} />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {status.name}
          </h3>
          <span className="flex h-5 items-center justify-center rounded-full bg-muted px-2 text-[10px] font-semibold text-muted-foreground">
            {issues.length}
          </span>
        </div>

        <button
          onClick={() => onAddIssueToStatus(status.id)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={`Add issue to ${status.name}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Issues Droppable Area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 overflow-y-auto min-h-[150px] transition-colors rounded-b-xl",
          isOver && "bg-primary/5 ring-1 ring-primary/30"
        )}
      >
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onClick={onIssueClick} />
          ))}
        </SortableContext>

        {issues.length === 0 && (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground/60 select-none">
            No issues
          </div>
        )}
      </div>
    </div>
  );
}
