import { cn } from "../../lib/utils";

export interface ProjectSpinnerProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const markSizes = { sm: "size-5", md: "size-14", lg: "size-[4.5rem]" };

export function ProjectSpinner({
  message = "Loading project…",
  subMessage,
  fullScreen = false,
  size = "md",
  className,
}: ProjectSpinnerProps) {
  const inline = size === "sm" && !fullScreen;
  const markSize = fullScreen && size === "md" ? "lg" : size;
  const status = (
    <div role="status" className={cn(
      "flex min-w-0 items-center",
      inline ? "min-h-10 gap-2.5 text-sm text-muted-foreground" : "flex-col gap-4 text-center",
      className,
    )}>
      <span className={cn("project-loader-mark", markSizes[markSize])} aria-hidden="true">
        <span className="project-loader-orbit" />
        {!inline && <span className="project-loader-board"><i /><i /><i /></span>}
      </span>
      <span className="min-w-0 break-words">
        <span className={cn("block", !inline && "font-semibold tracking-tight text-foreground")}>{message}</span>
        {subMessage && <small className="mt-1 block max-w-xs text-xs text-muted-foreground">{subMessage}</small>}
      </span>
    </div>
  );

  if (inline) return status;
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background p-6">
        <div className="w-full max-w-xs rounded-2xl border border-border bg-card px-6 py-8 shadow-sm">
          {status}
        </div>
      </div>
    );
  }

  return <div className="grid h-full min-h-[220px] w-full flex-1 place-items-center p-6">{status}</div>;
}

export default ProjectSpinner;
