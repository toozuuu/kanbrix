import type { ReactNode } from "react";
import type { useDraggable } from "@dnd-kit/core";
import { ArrowRight, GripVertical, RotateCcw } from "lucide-react";

export const tasks = [
  { key: "REL-12", title: "Write release notes", tag: "Docs" },
  { key: "REL-08", title: "Test the issue editor", tag: "QA" },
  { key: "REL-04", title: "Design the app icon", tag: "Design" },
];
export const stages = ["To do", "In progress", "Done"];
export const initial = [0, 1, 2];

export interface CardProps { index: number; stage: number; move: () => void }
type DragProps = Pick<ReturnType<typeof useDraggable>, "setNodeRef" | "transform" | "isDragging" | "listeners">;
export interface BoardProps { positions: number[]; list: boolean; move: (index: number, next?: number) => void }

export function StageColumn({ stage, children, register, over }: { stage: number; children: ReactNode; register?: (el: HTMLElement | null) => void; over?: boolean }) {
  return <section ref={register} className={over ? "demo-column drop-target" : "demo-column"}>
    <h3><i/>{stages[stage]}</h3>{children}
  </section>;
}

export function TaskCard({ index, stage, move, drag }: CardProps & { drag?: DragProps }) {
  const task = tasks[index];
  const transform = drag?.transform;
  return <div data-demo-card={task.key}>
    <div ref={drag?.setNodeRef} className="demo-ticket" data-dragging={drag?.isDragging}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}>
      <div className="ticket-meta"><span>{task.key}</span><span>{task.tag}</span></div>
      <strong className="ticket-grip" {...drag?.listeners}><GripVertical size={16} aria-hidden="true"/>{task.title}</strong>
      <button type="button" data-demo-action onClick={move} aria-label={task.title + ": " + (stage === 2 ? "reopen" : "advance to " + stages[stage + 1])}>
        {stage === 2 ? <RotateCcw size={13}/> : <ArrowRight size={13}/>}
        {["Start issue", "Mark done", "Reopen"][stage]}
      </button>
    </div>
  </div>;
}

export function DemoBoard({ positions, list, move, Column = StageColumn, Card = TaskCard }: BoardProps & {
  Column?: typeof StageColumn; Card?: typeof TaskCard;
}) {
  return <div className={list ? "demo-columns demo-list" : "demo-columns"}>
          {stages.map((stage, s) => <Column key={stage} stage={s}>
            {tasks.map((task, i) => positions[i] === s && <Card key={task.key} stage={s} index={i} move={() => move(i)}/>)}
            {!positions.includes(s) && <p className="empty-stage">No issues</p>}
          </Column>)}
        </div>;
}
