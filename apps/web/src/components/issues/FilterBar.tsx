import { SelectBox } from "../ui/SelectBox";
import { useIssueForm } from "../../context/useIssueForm";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Search, X, Tag } from "lucide-react";

interface FilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  priority?: string;
  onPriorityChange: (val?: string) => void;
  type?: string;
  onTypeChange: (val?: string) => void;
  assignment: string;
  onAssignmentChange: (value: string) => void;
  recentlyUpdated: boolean;
  onRecentlyUpdatedChange: () => void;
  overdue: boolean;
  onOverdueChange: () => void;
  selectedLabels?: string[];
  onSelectedLabelsChange?: (labelIds: string[]) => void;
  onClear: () => void;
}

export function FilterBar({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  type,
  onTypeChange,
  assignment, onAssignmentChange, recentlyUpdated, onRecentlyUpdatedChange, overdue, onOverdueChange,
  selectedLabels = [],
  onSelectedLabelsChange,
  onClear,
}: FilterBarProps) {
  const cfg = useIssueForm();
  const { labels: workspaceLabels } = useWorkspace();
  const hasFilters = Boolean(search || priority || type || assignment || overdue || recentlyUpdated || (selectedLabels.length > 0));

  return (
    <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap rounded-xl border border-border bg-card p-3">
      {/* Search Input */}
      <div className="relative col-span-2 min-w-0 sm:min-w-48 sm:flex-1 sm:max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          aria-label="Filter issues by text" placeholder="Filter issues…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-10 pl-8 pr-8 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
        />
        {search && (
          <button
            type="button" aria-label="Clear search" onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Priority Filter */}
      <SelectBox
        aria-label="Filter by priority" data-filter-active={Boolean(priority)}
        value={priority || ""}
        onChange={(e) => onPriorityChange(e.target.value || undefined)}
      >
        <option value="">All Priorities</option>
        {cfg?.priorities.map(v=><option key={v}>{v}</option>)}
      </SelectBox>

      {/* Type Filter */}
      <SelectBox
        aria-label="Filter by issue type" data-filter-active={Boolean(type)}
        value={type || ""}
        onChange={(e) => onTypeChange(e.target.value || undefined)}
      >
        <option value="">All Types</option>
        {cfg?.types.map(v=><option key={v}>{v}</option>)}
      </SelectBox>

      <SelectBox aria-label="Filter by assignment" data-filter-active={Boolean(assignment)} value={assignment} onChange={e => onAssignmentChange(e.target.value)}>
        <option value="">All assignees</option>
        <option value="mine">Assigned to me</option>
        <option value="unassigned">Unassigned</option>
      </SelectBox>
      <button type="button" aria-pressed={recentlyUpdated} onClick={onRecentlyUpdatedChange}
        title="Updated in the last 24 hours"
        className="h-10 rounded-md border border-input px-3 text-xs aria-pressed:bg-primary aria-pressed:text-primary-foreground">
        Recently updated
      </button>
      <button type="button" aria-pressed={overdue} onClick={onOverdueChange}
        className="h-10 rounded-md border border-input px-3 text-xs aria-pressed:bg-primary aria-pressed:text-primary-foreground">
        Overdue
      </button>

      {/* Label Filter - Multi-select as checkboxes */}
      {workspaceLabels && workspaceLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          {workspaceLabels.map(label => {
            const isSelected = selectedLabels.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  const newSelected = isSelected
                    ? selectedLabels.filter(id => id !== label.id)
                    : [...selectedLabels, label.id];
                  onSelectedLabelsChange?.(newSelected);
                }}
                className="px-2 py-0.5 text-xs rounded border transition-all"
                style={{
                  backgroundColor: isSelected ? label.color : 'transparent',
                  borderColor: label.color,
                  color: isSelected ? 'white' : (label.color.includes('#') ? undefined : undefined)
                }}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      )}

      {hasFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 h-10 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
}
