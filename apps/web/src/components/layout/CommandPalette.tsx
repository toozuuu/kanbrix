import {useTranslation} from "react-i18next";
import { Modal } from "../ui/Modal";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Kanban, ListTodo, FolderKanban, Users, Settings, ArrowRight } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import {api,request} from "../../lib/api";
import { Issue } from "../../types";

interface CommandPaletteProps {
  onToggle: () => void;
  isOpen: boolean;
  onClose: () => void;
  onSelectIssue?: (issue: Issue) => void;
}

export function CommandPalette({ isOpen, onClose, onToggle, onSelectIssue }: CommandPaletteProps) {
  const {t}=useTranslation();
  const [query, setQuery] = useState("");
  const [issues, setIssues] = useState<Pick<Issue,"id"|"project_id"|"identifier"|"title">[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { currentWorkspace,projects,setCurrentProject } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const issueKeyRef = useRef<string | null>(null);
  const navigatingRef = useRef<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen && document.querySelector("dialog[open]")) return;
        setQuery("");
        onToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (!isOpen || !currentWorkspace) {
      setIsLoading(false);
      setIssues([]);
      return;
    }

    const term = query.trim();
    if (term.length === 0) {
      setIsLoading(false);
      setIssues([]);
      issueKeyRef.current = null;
      navigatingRef.current = false;
      return;
    }

    // Check if query is an issue key format (e.g., "PROJ-123" or "ABC-123")
    const keyMatch = term.match(/^([A-Za-z]+[-\s]?)(\d+)$/);
    if (keyMatch && !navigatingRef.current) {
      const projectKey = keyMatch[1].replace(/[-\s]/g, "").toUpperCase();
      const issueNumber = keyMatch[2];

      // Find project by key
      const project = projects.find(p => p.project_key?.toUpperCase() === projectKey);
      if (project) {
        issueKeyRef.current = `${projectKey}-${issueNumber}`;
        navigatingRef.current = true;

        // Try to find the issue in current search results first
        setIssues([]);

        // Navigate directly to the issue
        setCurrentProject(project);
        void api.issues.list(project.id, { status_id: undefined, limit: 100 }).then(allIssues => {
          const targetIssue = allIssues.find(i => i.identifier === `${projectKey}-${issueNumber}`);
          if (targetIssue) {
            navigate(`/kanban?project=${project.id}&issue=${targetIssue.id}`);
            onSelectIssue?.(targetIssue);
            onClose();
          } else {
            // Issue not found, clear loading state
            setIsLoading(false);
          }
        }).catch(() => {
          setIsLoading(false);
        });
        return;
      }
    }

    setIssues([]);
    issueKeyRef.current = null;

    let current = true;
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const results = await request<typeof issues>(`/workspaces/${currentWorkspace.id}/search?q=${encodeURIComponent(term)}`);
        if (current) setIssues(results.slice(0, 8));
      } catch (e) {
        console.error(e);
      } finally {
        if (current) setIsLoading(false);
      }
    }, 200);

    return () => { current = false; clearTimeout(timer); };
  }, [query, isOpen, currentWorkspace?.id, projects, setCurrentProject]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");

    }
  }, [isOpen]);

  // Handle keyboard navigation within results
  if (!isOpen) return null;

  const quickLinks = [
    { label: "Go to Kanban Board", path: "/kanban", icon: Kanban },
    { label: "Go to Backlog & Sprints", path: "/backlog", icon: ListTodo },
    { label: "Go to Projects", path: "/projects", icon: FolderKanban },
    { label: "Manage Team Members", path: "/members", icon: Users },
    ...["Branding","Calendar","Issue forms","Templates","Permissions","History"].map(section=>({label:"Settings / "+section,path:"/settings?section="+encodeURIComponent(section),icon:Settings})),
    { label: "Workspace Settings", path: "/settings", icon: Settings },
  ].filter(item=>item.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("Search workspace")} maxWidth="xl">
        <div onKeyDown={event => {
          if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
          const buttons = Array.from(resultsRef.current?.querySelectorAll("button") ?? []);
          if (!buttons.length) return;
          if (event.key === "Enter") {
            if (event.target === inputRef.current) { event.preventDefault(); buttons[0].click(); }
            return;
          }
          event.preventDefault();
          const index = buttons.indexOf(event.target as HTMLButtonElement);
          const next = event.key === "ArrowDown" ? index + 1 : index < 0 ? buttons.length - 1 : index - 1;
          buttons[(next + buttons.length) % buttons.length].focus();
        }}>
        {/* Search Input */}
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            aria-label={t("Search workspace")}
            autoFocus
            type="text"
            placeholder={t("Type a command or search issues...")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-input pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground "
          />
        </div>

        {/* Results Body */}
        <div ref={resultsRef} className="mt-3 max-h-[min(24rem,50dvh)] overflow-y-auto overscroll-contain pr-1">
          {/* Issue Results */}
          {issues.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Issues ({issues.length})
              </div>
              {issues.map((issue) => {
                const project = projects.find(p => p.id === issue.project_id);
                if (!project) return null;
                return (
                  <button
                    key={issue.id}
                    onClick={async () => {
                      try {
                        const detail = await api.issues.get(issue.id);
                        setCurrentProject(project);
                        navigate(`/kanban?project=${project.id}&issue=${issue.id}`);
                        onSelectIssue?.(detail);
                        onClose();
                      } catch {
                        setIssues(prev => prev.filter(i => i.id !== issue.id));
                      }
                    }}
                    className="group flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left hover:bg-accent focus-visible:bg-accent"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="font-mono text-xs font-semibold text-primary shrink-0">
                        {issue.identifier}
                      </span>
                      <span className="text-sm text-foreground truncate font-medium">
                        {issue.title}
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Actions & Navigation */}
          {quickLinks.length>0 && (
            <div>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("Quick Navigation")}
              </div>
              {quickLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => {
                    onClose();
                    navigate(link.path);
                  }}
                  className="group flex min-h-10 items-center gap-3 w-full px-3 rounded-lg hover:bg-accent focus-visible:bg-accent text-left transition-colors text-sm font-medium text-foreground"
                >
                  <link.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{link.label}</span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                </button>
              ))}
            </div>
          )}

          {query.trim().length > 0 && issues.length === 0 && !quickLinks.length && !isLoading && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No issues found matching "{query}"
            </div>
          )}
        </div>
        </div>
    </Modal>
  );
}
