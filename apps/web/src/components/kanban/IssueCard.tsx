import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Issue } from "../../types";
import { Avatar } from "../ui/Avatar";
import { LabelBadge } from "../ui/LabelBadge";
import { cn, formatDate, getPriorityColor, getTypeBadge } from "../../lib/utils";
import { Calendar, UserRound } from "lucide-react";

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
        "group relative flex flex-col gap-2.5 rounded-xl border border-border/75 bg-card p-3.5 shadow-[var(--shadow-sm)] transition-all duration-150 hover:border-primary/45 hover:shadow-[var(--shadow-md)] cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-30 border-dashed border-primary",
        isOverlay && "rotate-2 scale-105 shadow-2xl border-primary ring-2 ring-primary/20 z-50 cursor-grabbing bg-card"
      )}
    >
      <p className="line-clamp-3 break-words text-sm font-medium leading-snug text-foreground">
        {issue.title}
      </p>

      {!!issue.labels?.length && (
        <div className="flex flex-wrap items-center gap-1">
          {issue.labels.slice(0, 3).map(label => (
            <LabelBadge key={label.id} label={label} className="max-w-full truncate text-xs" />
          ))}
          {issue.labels.length > 3 && (
            <span className="text-xs text-muted-foreground">+{issue.labels.length - 3}</span>
          )}
        </div>
      )}

      {issue.due_date && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar size={13} aria-hidden="true" /> {formatDate(issue.due_date)}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2 text-xs">
        <span className={cn("rounded border px-1.5 font-medium", typeBadge.color)}>{typeBadge.label}</span>
        <span className="font-mono text-muted-foreground group-hover:text-primary">{issue.identifier}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {issue.story_points != null && (
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground" title="Story points">
              {issue.story_points} pts
            </span>
          )}
          <span className={cn("rounded border px-1.5 font-medium", priorityStyle)}>{issue.priority}</span>
          {issue.assignee_name ? (
            <Avatar name={issue.assignee_name} size="sm" className="h-5 w-5 text-xs" />
          ) : (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary text-muted-foreground" title="Unassigned">
              <UserRound size={12} aria-label="Unassigned" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
