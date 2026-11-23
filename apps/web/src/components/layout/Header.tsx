import { useState } from "react";
import { Search, Plus, Bell, Check } from "lucide-react";
import { Button } from "../ui/Button";
import { useWorkspace } from "../../context/WorkspaceContext";
import { api } from "../../lib/api";
import { Notification } from "../../types";
import { formatRelativeTime } from "../../lib/utils";

interface HeaderProps {
  onOpenCreateIssue: () => void;
  onOpenCommandPalette: () => void;
}

export function Header({ onOpenCreateIssue, onOpenCommandPalette }: HeaderProps) {
  const { currentProject, currentWorkspace } = useWorkspace();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchNotifications = async () => {
    try {
      const list = await api.notifications.list();
      setNotifications(list);
      setHasFetched(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleNotifications = () => {
    if (!showNotifications && !hasFetched) {
      fetchNotifications();
    }
    setShowNotifications(!showNotifications);
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/60 bg-card/40 px-6 backdrop-blur-md">
      {/* Project breadcrumb / info */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{currentWorkspace?.name}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-xs font-semibold text-foreground">
          {currentProject ? currentProject.name : "All Projects"}
        </span>
        {currentProject && (
          <span className="text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-semibold ml-1">
            {currentProject.project_key}
          </span>
        )}
      </div>

      {/* Right Action Bar */}
      <div className="flex items-center gap-3">
        {/* Command Search Bar */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-border hover:bg-accent transition-all w-56 justify-between shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Search issues...</span>
          </div>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            Ctrl+K
          </kbd>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={handleToggleNotifications}
            className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-border/40"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2 z-50 w-80 rounded-xl border border-border bg-popover p-2 shadow-2xl animate-in fade-in-0 zoom-in-95">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                  <span className="text-xs font-semibold text-foreground">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-border/40 mt-1">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 text-xs transition-colors hover:bg-accent/50 ${
                          !n.read_at ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-foreground/90 font-medium">
                            {n.payload?.message || n.type}
                          </p>
                          {!n.read_at && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="text-primary hover:text-primary-hover p-0.5"
                              title="Mark read"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 block">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick New Issue Action */}
        <Button size="sm" onClick={onOpenCreateIssue} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>New Issue</span>
        </Button>
      </div>
    </header>
  );
}
