import { Search, X } from "lucide-react";

interface FilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  priority?: string;
  onPriorityChange: (val?: string) => void;
  type?: string;
  onTypeChange: (val?: string) => void;
  onClear: () => void;
}

export function FilterBar({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  type,
  onTypeChange,
  onClear,
}: FilterBarProps) {
  const hasFilters = Boolean(search || priority || type);

  return (
    <div className="flex flex-wrap items-center gap-2.5 pb-4">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter issues..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background/50 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Priority Filter */}
      <select
        value={priority || ""}
        onChange={(e) => onPriorityChange(e.target.value || undefined)}
        className="h-8 rounded-md border border-input bg-background/50 px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
      >
        <option value="">All Priorities</option>
        <option value="Urgent">Urgent</option>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
        <option value="Lowest">Lowest</option>
      </select>

      {/* Type Filter */}
      <select
        value={type || ""}
        onChange={(e) => onTypeChange(e.target.value || undefined)}
        className="h-8 rounded-md border border-input bg-background/50 px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
      >
        <option value="">All Types</option>
        <option value="Task">Task</option>
        <option value="Bug">Bug</option>
        <option value="Story">Story</option>
        <option value="Epic">Epic</option>
      </select>

      {/* Clear Filters */}
      {hasFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 h-8 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
}
