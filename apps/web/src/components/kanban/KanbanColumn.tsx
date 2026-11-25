import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useLayoutEffect, useRef, useState } from "react";
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

const ticketsBeforeScrolling = 20;

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
  const cardList = useRef<HTMLDivElement>(null);
  const [scrollHeight, setScrollHeight] = useState<number>();
  const needsScroll = issues.length > ticketsBeforeScrolling;

  useLayoutEffect(() => {
    const list = cardList.current;
    if (!needsScroll || !list) return;

    const visibleCards = Array.from(list.children).slice(0, ticketsBeforeScrolling);
    const lastCard = visibleCards.at(-1);
    if (!(lastCard instanceof HTMLElement)) return;

    // Use layout positions so drag transforms don't change the scroll viewport.
    const measure = () => {
      const bottomPadding = parseFloat(getComputedStyle(list).paddingBottom);
      setScrollHeight(Math.ceil(lastCard.offsetTop + lastCard.offsetHeight + bottomPadding));
    };
    measure();

    const observer = new ResizeObserver(measure);
    visibleCards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [issues, needsScroll]);

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

  const wipLimit = status.wip_limit ?? null;
  const overWip = wipLimit !== null && wipLimit > 0 && issues.length > wipLimit;

  return (
    <section data-drop-active={isOver || undefined} ref={setNodeRef} aria-label={status.name} className={cn(
      "motion-board-column flex w-[min(17rem,78vw)] shrink-0 flex-col rounded-[var(--card-radius)] border border-border/75 bg-secondary/45 shadow-[var(--shadow-sm)] transition-colors",
      overWip && "border-amber-500/70 bg-amber-500/[0.04]",
      isOver && "border-primary/50 bg-primary/5 ring-2 ring-primary/15",
    )}>
      {/* Column Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", getStatusColor(status.category))} />
          <h3 className="text-sm font-semibold text-foreground">
            {status.name}
          </h3>
          <span
            className={cn(
              "flex h-5 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums",
              overWip
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground",
            )}
            title={overWip ? `WIP limit (${wipLimit}) exceeded` : undefined}
          >
            {issues.length}{loadMore ? "+" : ""}{wipLimit ? ` / ${wipLimit}` : ""}
          </span>
        </div>

      </div>

      {/* Issues Droppable Area */}
      <div
        className={cn("min-h-3", needsScroll && "overflow-y-auto")}
        style={needsScroll ? { maxHeight: scrollHeight } : undefined}
      >
        <div ref={cardList} className="relative space-y-2 px-2 py-1">
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
