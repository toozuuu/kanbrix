import { cn } from "../../lib/utils";

export interface Label {
  id: string;
  name: string;
  color?: string;
  workspace_id?: string;
}

export interface LabelBadgeProps {
  label: Label;
  className?: string;
}

export function LabelBadge({ label, className }: LabelBadgeProps) {
  const colorStyle = label.color ? { backgroundColor: `${label.color}15`, borderColor: label.color } : {};
  const indicatorColor = label.color || "hsl(var(--primary))";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        "border transition-all duration-200",
        "bg-popover text-popover-foreground",
        "hover:bg-popover/80",
        className
      )}
      style={colorStyle}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: indicatorColor }} />
      {label.name}
    </span>
  );
}