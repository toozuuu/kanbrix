import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Issue } from "../../types";
import { Avatar } from "../ui/Avatar";
import { LabelBadge } from "../ui/LabelBadge";
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
        "group relative flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-30 border-dashed border-primary",
        isOverlay && "rotate-2 scale-105 shadow-2xl border-primary ring-2 ring-primary/20 z-50 cursor-grabbing bg-card"
      )}
    >
      {/* Top Row: Type, Key, Priority */}
      <div className="flex items-center justify-between gap-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 truncate">
          <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-semibold tracking-wide", typeBadge.color)}>
            {typeBadge.label}
          </span>
          <span className="font-mono text-muted-foreground font-semibold group-hover:text-primary transition-colors duration-200">
            {issue.identifier}
          </span>
        </div>
        <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wider", priorityStyle)}>
          {issue.priority}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-relaxed">
        {issue.title}
      </p>

      {/* Bottom Row: Due date & Assignee */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {issue.due_date && (
            <span className="flex items-center gap-1 text-[10px]">
              <Calendar className="h-3 w-3" />
              {formatDate(issue.due_date)}
            </span>
          )}
          {issue.labels.length > 0 && (
            <span className="flex items-center gap-1">
              {issue.labels.slice(0, 2).map(label => (
                <span key={label.id} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  {label.name}
                </span>
              ))}
              {issue.labels.length > 2 && (
                <span className="text-[10px] text-muted-foreground/60">
                  +{issue.labels.length - 2}
                </span>
              )}
            </span>
          )}
        </div>

        {issue.assignee_name ? (
          <Avatar name={issue.assignee_name} size="sm" className="h-5 w-5 text-[9px]" />
        ) : (
          <span className="text-[10px] text-muted-foreground/60 italic">Unassigned</span>
        )}
      </div>

      {/* Labels - shown on hover */}
      {issue.labels.length > 0 && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur rounded-xl p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto border-t border-primary/30">
          <div className="flex flex-wrap gap-1.5 mt-1">
            {issue.labels.map((label) => (
              <LabelBadge key={label.id} label={label} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
