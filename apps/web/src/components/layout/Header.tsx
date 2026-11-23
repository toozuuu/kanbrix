import { useDropdownDisclosure } from "../ui/useDropdownDisclosure";
import {useTranslation} from "react-i18next";
import { useConfiguration } from "../../context/useConfiguration";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Search, Plus, Bell, Check, HelpCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { useWorkspace } from "../../context/WorkspaceContext";
import { api } from "../../lib/api";
import { Notification } from "../../types";
import { formatRelativeTime } from "../../lib/utils";

interface HeaderProps {
  onOpenCreateIssue: () => void;
  onOpenCommandPalette: () => void;
  onOpenKeyboardShortcuts: () => void;
}

export function Header({ onOpenCreateIssue, onOpenCommandPalette, onOpenKeyboardShortcuts }: HeaderProps) {
  const {t}=useTranslation();
  const cfg=useConfiguration().data?.configuration;
  const { currentProject, currentWorkspace } = useWorkspace();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const disclosure = useDropdownDisclosure(showNotifications, setShowNotifications);
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
    <header className="flex h-14 shrink-0 gap-2 items-center justify-between border-b border-border/60 bg-card px-3 sm:px-6">
      <Link to="/dashboard" className="flex shrink-0 items-center gap-2 text-lg font-semibold"><img referrerPolicy="no-referrer" src={cfg?.logo || "/kanbrix.svg"} alt="" width="32" height="32" />{cfg?.brand || "Kanbrix"}</Link>
      <div className="hidden min-w-0 flex-1 ml-4 items-center gap-2 md:flex">
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
          aria-label="Search issues" onClick={onOpenCommandPalette}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-border hover:bg-accent transition-all sm:w-56 justify-between shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search issues…</span>
          </div>
          <kbd className="hidden sm:inline rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            Ctrl+K
          </kbd>
        </button>

        {/* Notifications */}
        <div className="relative" {...disclosure.container}>
          <button
            {...disclosure.trigger}
            onClick={handleToggleNotifications}
            className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-border/40"
            title={t("Notifications")}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div {...disclosure.panel} className="dropdown-surface fixed inset-x-3 top-14 z-50 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 sm:w-80 ">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                  <span className="text-xs font-semibold text-foreground">{t("Notifications")}</span>
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
          <span>{t("New Issue")}</span>
        </Button>

        {/* Keyboard Shortcuts Help */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenKeyboardShortcuts}
          className="gap-1.5"
          title={t("keyboard_shortcuts.help")}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
