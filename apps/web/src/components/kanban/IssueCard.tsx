import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Issue } from "../../types";
import { Avatar } from "../ui/Avatar";
import { cn, formatDate, getPriorityColor, getTypeBadge } from "../../lib/utils";
import { Calendar } from "lucide-react";

interface IssueCardProps {
  issue: Issue;
  onClick: (issue: Issue) => void;
  isOverlay?: boolean;
}

export function IssueCard({ issue, onClick, isOverlay = false }: IssueCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id,
    data: { issue },
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityStyle = getPriorityColor(issue.priority);
  const typeBadge = getTypeBadge(issue.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(issue)}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border border-border/80 bg-card p-3 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-30 border-dashed border-primary",
        isOverlay && "rotate-2 scale-105 shadow-2xl border-primary ring-2 ring-primary/20 z-50 cursor-grabbing bg-card"
      )}
    >
      {/* Top Row: Type, Key, Priority */}
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <div className="flex items-center gap-1.5 truncate">
          <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-semibold tracking-wide", typeBadge.color)}>
            {typeBadge.label}
          </span>
          <span className="font-mono text-muted-foreground font-semibold group-hover:text-primary transition-colors">
            {issue.identifier}
          </span>
        </div>
        <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wider", priorityStyle)}>
          {issue.priority}
        </span>
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">
        {issue.title}
      </p>

      {/* Bottom Row: Due date & Assignee */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          {issue.due_date && (
            <span className="flex items-center gap-1 text-[10px]">
              <Calendar className="h-3 w-3" />
              {formatDate(issue.due_date)}
            </span>
          )}
        </div>

        {issue.assignee_name ? (
          <Avatar name={issue.assignee_name} size="sm" className="h-5 w-5 text-[9px]" />
        ) : (
          <span className="text-[10px] text-muted-foreground/60 italic">Unassigned</span>
        )}
      </div>
    </div>
  );
}
