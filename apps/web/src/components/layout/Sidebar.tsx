import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Kanban,
  ListTodo,
  FolderKanban,
  Users,
  Settings,
  LogOut,
  Moon,
  Sun,
  Laptop,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useTheme } from "../../context/ThemeContext";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { Avatar } from "../ui/Avatar";
import { cn } from "../../lib/utils";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const { currentProject, projects, setCurrentProject } = useWorkspace();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Kanban Board", href: "/kanban", icon: Kanban },
    { label: "Backlog & Sprints", href: "/backlog", icon: ListTodo },
    { label: "Projects", href: "/projects", icon: FolderKanban },
    { label: "Team Members", href: "/members", icon: Users },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-card/60 backdrop-blur-md transition-all duration-200 z-30 select-none",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand & Collapse Toggle */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-border/60">
        {!collapsed && (
          <Link to="/dashboard" className="flex items-center gap-2 font-bold tracking-tight text-foreground">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-wide">
              Rust<span className="text-primary">Track</span>
            </span>
          </Link>
        )}
        {collapsed && (
          <div className="mx-auto h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Workspace Switcher */}
      <div className="p-3 border-b border-border/40">
        {!collapsed ? (
          <WorkspaceSwitcher />
        ) : (
          <div className="flex justify-center">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              RT
            </div>
          </div>
        )}
      </div>

      {/* Active Project Selector */}
      {!collapsed && projects.length > 0 && (
        <div className="px-3 pt-3 pb-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Active Project
          </label>
          <select
            value={currentProject?.id || ""}
            onChange={(e) => {
              const selected = projects.find((p) => p.id === e.target.value);
              if (selected) setCurrentProject(selected);
            }}
            className="w-full text-xs rounded-md border border-input bg-background/50 px-2 py-1.5 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.project_key}] {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Theme & User */}
      <div className="p-2 border-t border-border/60 space-y-2">
        {/* Theme Toggles */}
        <div className={cn("flex items-center justify-between px-2 py-1", collapsed && "justify-center")}>
          {!collapsed && <span className="text-xs text-muted-foreground font-medium">Theme</span>}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme("light")}
              className={cn("p-1 rounded text-muted-foreground hover:text-foreground", theme === "light" && "text-primary")}
              title="Light mode"
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={cn("p-1 rounded text-muted-foreground hover:text-foreground", theme === "dark" && "text-primary")}
              title="Dark mode"
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTheme("system")}
              className={cn("p-1 rounded text-muted-foreground hover:text-foreground", theme === "system" && "text-primary")}
              title="System preference"
            >
              <Laptop className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* User Card */}
        {user && (
          <div className={cn("flex items-center justify-between p-2 rounded-lg bg-accent/40 border border-border/40", collapsed && "justify-center p-1.5")}>
            <div className="flex items-center gap-2 truncate">
              <Avatar name={user.name} size="sm" />
              {!collapsed && (
                <div className="truncate">
                  <div className="text-xs font-semibold truncate text-foreground">{user.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={logout}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Log out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
