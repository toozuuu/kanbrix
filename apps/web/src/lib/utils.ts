import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateString: string) {
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch (e) {
    return dateString;
  }
}

export function formatDate(dateString: string) {
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch (e) {
    return dateString;
  }
}

export function getInitials(name: string): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getPriorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case "urgent":
      return "text-red-500 dark:text-red-300 bg-red-500/10 border-red-500/20";
    case "high":
      return "text-amber-500 dark:text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "medium":
      return "text-blue-500 dark:text-blue-300 bg-blue-500/10 border-blue-500/20";
    case "low":
    case "lowest":
      return "text-slate-500 dark:text-slate-300 bg-slate-500/10 border-slate-500/20";
    default:
      return "text-muted-foreground bg-muted border-border";
  }
}

export function getTypeBadge(type: string) {
  switch (type.toLowerCase()) {
    case "bug":
      return { label: "Bug", color: "text-rose-500 dark:text-rose-300 bg-rose-500/10 border-rose-500/20" };
    case "story":
      return { label: "Story", color: "text-emerald-500 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20" };
    case "epic":
      return { label: "Epic", color: "text-purple-500 dark:text-purple-300 bg-purple-500/10 border-purple-500/20" };
    case "task":
    default:
      return { label: type, color: "text-sky-500 dark:text-sky-300 bg-sky-500/10 border-sky-500/20" };
  }
}
