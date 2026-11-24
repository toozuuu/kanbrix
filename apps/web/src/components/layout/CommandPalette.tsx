import {useTranslation} from "react-i18next";
import { Modal } from "../ui/Modal";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Kanban, ListTodo, FolderKanban, Users, Settings, ArrowRight, ExternalLink } from "lucide-react";
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
  const issueIndexRef = useRef<number>(0);
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
      issueIndexRef.current = 0;
    }
  }, [isOpen]);

  // Handle keyboard navigation within results
  useEffect(() => {
    if (!isOpen || issues.length === 0) return;

    const handleNav = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onToggle();
        setQuery("");
        return;
      }
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        issueIndexRef.current = (issueIndexRef.current + 1) % issues.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        issueIndexRef.current = (issueIndexRef.current - 1 + issues.length) % issues.length;
      } else if (e.key === "Enter" && issues[issueIndexRef.current]) {
        const issue = issues[issueIndexRef.current];
        const project = projects.find(p => p.id === issue.project_id);
        if (!project) return;
        setCurrentProject(project);
        try {
          const detail = await api.issues.get(issue.id);
          navigate(`/kanban?project=${project.id}&issue=${issue.id}`);
          onSelectIssue?.(detail);
          onClose();
        } catch {
          setIssues(prev => prev.filter(i => i.id !== issue.id));
        }
      }
    };

    window.addEventListener("keydown", handleNav);
    return () => window.removeEventListener("keydown", handleNav);
  }, [issues, isOpen, projects, setCurrentProject, navigate, onSelectIssue, onClose, onToggle]);

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
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground mr-3 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder={t("Type a command or search issues...")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground "
          />
        </div>

        {/* Results Body */}
        <div className="max-h-80 overflow-y-auto p-2">
          {/* Issue Results */}
          {issues.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Issues ({issues.length})
              </div>
              {issues.map((issue, idx) => {
                const project = projects.find(p => p.id === issue.project_id);
                if (!project) return null;
                return (
                  <button
                    key={issue.id}
                    ref={idx === issueIndexRef.current ? undefined : undefined}
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
                    className={`flex items-center justify-between w-full p-2 rounded-lg text-left transition-colors group ${
                      idx === issueIndexRef.current ? 'bg-accent ring-2 ring-primary' : 'hover:bg-accent'
                    }`}
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
                  className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-accent text-left transition-colors text-xs font-medium text-foreground"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
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
    </Modal>
  );
}
