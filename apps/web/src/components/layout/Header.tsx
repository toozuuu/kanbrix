import { ProjectSpinner } from "../ui/ProjectSpinner";
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
  const [notificationStatus, setNotificationStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const fetchNotifications = async () => {
    try {
      setNotificationStatus("loading");
      const list = await api.notifications.list();
      setNotifications(list);
      setNotificationStatus("ready");
    } catch (e) {
      setNotificationStatus("error");
    }
  };

  const handleToggleNotifications = () => {
    if (!showNotifications && (notificationStatus === "idle" || notificationStatus === "error")) {
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
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-2 sm:gap-4 sm:px-4">
      <Link to="/dashboard" aria-label={cfg?.brand || "Kanbrix"} className="flex min-w-0 shrink-0 items-center gap-2 md:w-52 lg:w-60">
        <img referrerPolicy="no-referrer" src={cfg?.logo || "/kanbrix.svg"} alt="" width="32" height="32" className="h-8 w-8 shrink-0 object-contain"/>
        <span className="truncate font-serif text-xl tracking-tight">{cfg?.brand || "Kanbrix"}</span>
      </Link>
      <div className="hidden min-w-0 flex-1 items-center gap-3 border-l border-border pl-4 md:flex">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{currentWorkspace?.name}</p>
          <p className="truncate text-sm font-semibold">{currentProject?.name || t("All Projects")}</p>
        </div>
        {currentProject && <span className="hidden max-w-24 truncate rounded border border-border px-1.5 font-mono text-xs text-muted-foreground xl:inline">{currentProject.project_key}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Command Search Bar */}
        <button
          type="button"
          aria-label="Search issues" onClick={onOpenCommandPalette}
          className="flex h-11 min-w-11 items-center justify-center gap-4 rounded-md text-sm text-muted-foreground hover:bg-accent sm:h-9 sm:justify-between sm:border sm:border-border sm:bg-background sm:px-3 lg:w-52"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Search issues…</span>
          </div>
          <kbd className="hidden sm:inline rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
            /
          </kbd>
        </button>

        {/* Notifications */}
        <div className="relative" {...disclosure.container}>
          <button
            type="button"
            {...disclosure.trigger}
            onClick={handleToggleNotifications}
            className="relative grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors sm:size-9"
            aria-label={t("Notifications")}
            title={t("Notifications")}
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
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
                    <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-border/40 mt-1">
                  {notificationStatus === "loading" ? <ProjectSpinner size="sm" message="Loading notifications." className="p-3"/>
                    : notificationStatus === "error" ? <p role="alert" className="p-3 text-sm">Could not load notifications. <button type="button" className="underline" onClick={() => void fetchNotifications()}>Retry</button></p>
                    : notifications.length === 0 ? (
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
                              type="button"
                              onClick={() => handleMarkRead(n.id)}
                              className="text-primary hover:text-primary-hover p-0.5"
                              aria-label="Mark read"
                              title="Mark read"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1 block">
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
        <Button type="button" size="sm" aria-label={t("New Issue")} onClick={onOpenCreateIssue} className="size-11 gap-1.5 p-0 sm:h-9 sm:w-auto sm:px-3">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{t("New Issue")}</span>
        </Button>

        {/* Keyboard Shortcuts Help */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onOpenKeyboardShortcuts}
          className="size-11 p-0 sm:size-9"
          aria-label={t("keyboard_shortcuts.help")}
          title={t("keyboard_shortcuts.help")}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
