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
  DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Issue, IssueStatus } from "../../types";
import { KanbanColumn } from "./KanbanColumn";
import { IssueCard } from "./IssueCard";
import { api } from "../../lib/api";
import { useToast } from "../ui/Toast";

interface KanbanBoardProps {
  statuses: IssueStatus[];
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
  onAddIssueToStatus: (statusId: string) => void;
  onRefresh: () => void;
}

export function KanbanBoard({
  statuses,
  issues: initialIssues,
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

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    // Check if dragging over another issue or directly over a column status
    const isActiveAnIssue = active.data.current?.issue !== undefined;
    const isOverAnIssue = over.data.current?.issue !== undefined;
    const isOverAStatus = over.data.current?.status !== undefined;

    if (!isActiveAnIssue) return;

    // Moving over another issue in a different column
    if (isOverAnIssue) {
      const activeIssue = issues.find((i) => i.id === activeId);
      const overIssue = issues.find((i) => i.id === overId);

      if (activeIssue && overIssue && activeIssue.status_id !== overIssue.status_id) {
        setIssues((prev) => {
          const activeIndex = prev.findIndex((i) => i.id === activeId);
          const overIndex = prev.findIndex((i) => i.id === overId);

          const updated = [...prev];
          updated[activeIndex] = {
            ...updated[activeIndex],
            status_id: overIssue.status_id,
            status_name: overIssue.status_name,
            status_category: overIssue.status_category,
          };

          return arrayMove(updated, activeIndex, overIndex);
        });
      }
    }

    // Moving directly over an empty column or status container
    if (isOverAStatus) {
      const statusId = over.id as string;
      const statusObj = statuses.find((s) => s.id === statusId);

      if (statusObj) {
        setIssues((prev) => {
          const activeIndex = prev.findIndex((i) => i.id === activeId);
          if (activeIndex === -1) return prev;

          const updated = [...prev];
          if (updated[activeIndex].status_id !== statusId) {
            updated[activeIndex] = {
              ...updated[activeIndex],
              status_id: statusId,
              status_name: statusObj.name,
              status_category: statusObj.category,
            };
          }
          return updated;
        });
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIssue(null);

    if (!over) return;

    const activeId = active.id as string;

    const currentIssue = issues.find((i) => i.id === activeId);
    if (!currentIssue) return;

    const currentStatusId = currentIssue.status_id;

    // Get ordered issues in target status
    const columnIssues = issues.filter((i) => i.status_id === currentStatusId);
    const activeIndex = columnIssues.findIndex((i) => i.id === activeId);

    // Calculate new position
    let newPosition = 1000.0;
    if (columnIssues.length === 1) {
      newPosition = 1000.0;
    } else if (activeIndex === 0) {
      const nextPos = columnIssues[1]?.position || 2000.0;
      newPosition = nextPos / 2.0;
    } else if (activeIndex === columnIssues.length - 1) {
      const prevPos = columnIssues[activeIndex - 1]?.position || 1000.0;
      newPosition = prevPos + 1000.0;
    } else {
      const prevPos = columnIssues[activeIndex - 1]?.position || 1000.0;
      const nextPos = columnIssues[activeIndex + 1]?.position || prevPos + 2000.0;
      newPosition = (prevPos + nextPos) / 2.0;
    }

    // Apply optimistic update locally
    setIssues((prev) =>
      prev.map((i) => (i.id === activeId ? { ...i, position: newPosition } : i))
    );

    // Persist to server
    try {
      await api.issues.reorder(activeId, {
        status_id: currentStatusId,
        position: newPosition,
      });
    } catch (err: any) {
      toast("Failed to update issue order on server", "error");
      onRefresh(); // rollback to server state
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-4 items-start">
        {statuses.map((status) => {
          const columnIssues = issues
            .filter((i) => i.status_id === status.id)
            .sort((a, b) => a.position - b.position);

          return (
            <KanbanColumn
              key={status.id}
              status={status}
              issues={columnIssues}
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
