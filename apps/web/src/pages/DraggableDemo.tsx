import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, pointerWithin } from "@dnd-kit/core";
import { DemoBoard, StageColumn, TaskCard, tasks, type CardProps, type BoardProps } from "./DemoBoard";
import type { ComponentProps } from "react";

function Column(props: ComponentProps<typeof StageColumn>) {
  const { setNodeRef, isOver } = useDroppable({ id: props.stage });
  return <StageColumn {...props} register={setNodeRef} over={isOver}/>;
}

function Card(props: CardProps) {
  const drag = useDraggable({ id: tasks[props.index].key });
  return <TaskCard {...props} drag={drag}/>;
}

export default function DraggableDemo(props: BoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  return <DndContext id="landing-board" sensors={sensors} collisionDetection={pointerWithin}
    onDragEnd={({ active, over }) => {
      const index = tasks.findIndex(task => task.key === active.id);
      if (index >= 0 && typeof over?.id === "number") props.move(index, over.id);
    }}>
    <DemoBoard {...props} Column={Column} Card={Card}/>
  </DndContext>;
}
