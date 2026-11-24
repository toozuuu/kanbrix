import { cn } from "../../lib/utils";

export interface ProjectSpinnerProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProjectSpinner({
  message = "Loading project…",
  subMessage,
  fullScreen = false,
  size = "md",
  className,
}: ProjectSpinnerProps) {
  if (size === "sm" && !fullScreen) {
    return <div role="status" className={cn("flex min-h-10 items-center gap-2 text-sm text-muted-foreground", className)}>
      <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/30 border-t-primary motion-safe:animate-spin"/>
      <span>{message}{subMessage && <small className="block">{subMessage}</small>}</span>
    </div>;
  }

  const sizeMap = {
    sm: {
      box: "h-10 w-10",
      logo: "h-5 w-5 rounded-lg p-0.5",
      title: "text-xs",
      sub: "text-xs",
      stroke: 2.5,
    },
    md: {
      box: "h-16 w-16",
      logo: "h-9 w-9 rounded-xl p-1",
      title: "text-sm",
      sub: "text-xs",
      stroke: 3,
    },
    lg: {
      box: "h-24 w-24",
      logo: "h-12 w-12 rounded-2xl p-1.5",
      title: "text-base",
      sub: "text-sm",
      stroke: 3.5,
    },
  };

  const effectiveSize = fullScreen && size === "md" ? "lg" : size;
  const config = sizeMap[effectiveSize];

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-4 text-center select-none", className)}
    >
      <div className={cn("relative flex items-center justify-center", config.box)}>
        {/* Ambient radial blur halo */}
        <div className="absolute -inset-2 rounded-full bg-primary/20 blur-xl animate-pulse" />

        {/* Animated dual-tone spinner track */}
        <svg
          className="absolute inset-0 h-full w-full animate-spin"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle track background */}
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className="text-muted/40 dark:text-muted/20"
          />
          {/* Dynamic rotating gradient arc */}
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="hsl(var(--primary))"
            strokeWidth={config.stroke + 0.5}
            strokeLinecap="round"
            strokeDasharray="95 130"
          />
        </svg>

        {/* Center brand mark badge */}
        <div
          className={cn(
            "relative z-10 flex items-center justify-center bg-card/90 shadow-md border border-border/80 backdrop-blur-sm transition-transform duration-300",
            config.logo
          )}
        >
          <img
            src="/kanbrix.svg"
            alt="Kanbrix"
            className="h-full w-full object-contain animate-pulse"
          />
        </div>
      </div>

      {/* Label and breathing dots */}
      <div className="flex flex-col items-center">
        <div className={cn("flex items-center gap-1.5 font-semibold tracking-tight text-foreground", config.title)}>
          <span>{message}</span>
          <span className="flex items-center gap-0.5 text-primary ml-0.5">
            <span
              className="inline-block h-1 w-1 rounded-full bg-current animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="inline-block h-1 w-1 rounded-full bg-current animate-bounce"
              style={{ animationDelay: "160ms" }}
            />
            <span
              className="inline-block h-1 w-1 rounded-full bg-current animate-bounce"
              style={{ animationDelay: "320ms" }}
            />
          </span>
        </div>
        {subMessage && (
          <p className={cn("mt-1 text-muted-foreground max-w-xs font-normal", config.sub)}>
            {subMessage}
          </p>
        )}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-background/95 backdrop-blur-sm transition-all duration-300">
        <div className="relative p-8 rounded-3xl border border-border/40 bg-card/40 shadow-2xl backdrop-blur-md">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[220px] w-full flex-1 items-center justify-center p-6">
      {content}
    </div>
  );
}

export default ProjectSpinner;
