import React, { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Issue, IssueStatus } from "../../types";
import { KanbanColumn } from "./KanbanColumn";
import { IssueCard } from "./IssueCard";
import { api } from "../../lib/api";
import { useToast } from "../ui/Toast";

interface KanbanBoardProps {
  statuses: IssueStatus[];
  issues: Issue[];
  nextPositions: Map<string, number>;
  loadMore: (id: string) => void;
  onIssueClick: (issue: Issue) => void;
  onAddIssueToStatus: (statusId: string) => void;
  onRefresh: () => void;
}

export function KanbanBoard({
  statuses,
  issues: initialIssues,
  nextPositions, loadMore,
  onIssueClick,
  onAddIssueToStatus,
  onRefresh,
}: KanbanBoardProps) {
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // 4px drag before activating prevents accidental drags on click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const issue = issues.find((i) => i.id === active.id);
    if (issue) setActiveIssue(issue);
  };

  const issuesByStatus = React.useMemo(() => {
    const columns = new Map<string, Issue[]>();
    for (const issue of issues) {
      const column = columns.get(issue.status_id);
      if (column) column.push(issue);
      else columns.set(issue.status_id, [issue]);
    }
    for (const column of columns.values()) {
      column.sort((a, b) => a.position - b.position);
    }
    return columns;
  }, [issues]);

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveIssue(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id;
    const issue = issues.find((item) => item.id === activeId);
    const targetCard: Issue | undefined = over.data.current?.issue;
    const status = statuses.find((item) => item.id === (targetCard?.status_id ?? over.id));
    if (!issue || !status) return;

    const column = issuesByStatus.get(status.id) ?? [];
    const remaining = column.filter((item) => item.id !== activeId);
    const index = targetCard ? column.findIndex((item) => item.id === targetCard.id) : remaining.length;
    if (index < 0 || (issue.status_id === status.id && column[index]?.id === activeId)) return;

    const before = remaining[index - 1]?.position;
    const after = remaining[index]?.position ?? nextPositions.get(status.id);
    const newPosition = before === undefined
      ? (after === undefined ? 1000 : after / 2)
      : (after === undefined ? before + 1000 : (before + after) / 2);
    const currentStatusId = status.id;
    setIssues((prev) => prev.map((item) => item.id === activeId
      ? { ...item, status_id: status.id, status_name: status.name, status_category: status.category, position: newPosition }
      : item));

    // Persist to server
    try {
      await api.issues.reorder(issue.id, {
        status_id: currentStatusId,
        position: newPosition,
      });
      onRefresh();
    } catch {
      setIssues(initialIssues);
      toast("Failed to update issue order on server", "error");
      onRefresh(); // rollback to server state
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveIssue(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-start gap-3 overflow-x-auto overscroll-x-contain pb-3">
        {statuses.map((status) => {
          const columnIssues = issuesByStatus.get(status.id) ?? [];

          return (
            <KanbanColumn
              key={status.id}
              status={status}
              issues={columnIssues}
              loadMore={nextPositions.has(status.id) ? () => loadMore(status.id) : undefined}
              onIssueClick={onIssueClick}
              onAddIssueToStatus={onAddIssueToStatus}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeIssue ? <IssueCard issue={activeIssue} onClick={() => {}} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
