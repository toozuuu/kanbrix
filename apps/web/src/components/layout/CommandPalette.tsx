import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Kanban, ListTodo, FolderKanban, Users, Settings, ArrowRight } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { api } from "../../lib/api";
import { Issue } from "../../types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIssue?: (issue: Issue) => void;
}

export function CommandPalette({ isOpen, onClose, onSelectIssue }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { currentProject } = useWorkspace();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !currentProject || query.trim().length === 0) {
      setIssues([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const results = await api.issues.list(currentProject.id, { search: query });
        setIssues(results.slice(0, 8));
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isOpen, currentProject?.id]);

  if (!isOpen) return null;

  const quickLinks = [
    { label: "Go to Kanban Board", path: "/kanban", icon: Kanban },
    { label: "Go to Backlog & Sprints", path: "/backlog", icon: ListTodo },
    { label: "Go to Projects", path: "/projects", icon: FolderKanban },
    { label: "Manage Team Members", path: "/members", icon: Users },
    { label: "Workspace Settings", path: "/settings", icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-50 w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground mr-3 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search issues..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Results Body */}
        <div className="max-h-80 overflow-y-auto p-2">
          {/* Issue Results */}
          {issues.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Issues ({issues.length})
              </div>
              {issues.map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => {
                    onClose();
                    if (onSelectIssue) onSelectIssue(issue);
                  }}
                  className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-accent text-left transition-colors group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="font-mono text-xs font-semibold text-primary shrink-0">
                      {issue.identifier}
                    </span>
                    <span className="text-xs text-foreground truncate font-medium">
                      {issue.title}
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}

          {/* Quick Actions & Navigation */}
          {query.trim().length === 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Navigation
              </div>
              {quickLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => {
                    onClose();
                    navigate(link.path);
                  }}
                  className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-accent text-left transition-colors text-xs font-medium text-foreground"
                >
                  <link.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{link.label}</span>
                </button>
              ))}
            </div>
          )}

          {query.trim().length > 0 && issues.length === 0 && !isLoading && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No issues found matching "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
