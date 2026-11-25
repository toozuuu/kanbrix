import { ProjectSpinner } from "../ui/ProjectSpinner";
import { SelectBox } from "../ui/SelectBox";
import {useTranslation} from "react-i18next";
import { useWorkflow } from "../../context/useWorkflow";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Kanban, ListTodo, FolderKanban, Users, Settings, LogOut, UserCheck,
  Moon, Sun, Laptop, PanelLeftClose, PanelLeftOpen, Layers3,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useTheme } from "../../context/ThemeContext";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { Avatar } from "../ui/Avatar";
import { ConfirmModal } from "../ui/ConfirmModal";
import { cn } from "../../lib/utils";

const groups = [
  { label: "Project views", items: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Board", href: "/kanban", icon: Kanban },
    { label: "Backlog & sprints", href: "/backlog", icon: ListTodo },
  ] },
  { label: "Workspace", items: [
    { label: "My Work", href: "/my-work", icon: UserCheck },
    { label: "Projects", href: "/projects", icon: FolderKanban },
    { label: "Team members", href: "/members", icon: Users },
    { label: "Settings", href: "/settings", icon: Settings },
  ] },
];
const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

export function Sidebar({ collapsed, onCollapsedChange }: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const {t}=useTranslation();
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { currentProject, projects, setCurrentProject, currentWorkspace, projectStatus, refreshProjects } = useWorkspace();
  const workflow=useWorkflow();
  const { theme, setTheme } = useTheme();
  const toggle = () => onCollapsedChange(!collapsed);
  const closeMobileNavigation = () => {
    if (window.innerWidth < 768 && !collapsed) onCollapsedChange(true);
  };

  return (
    <div className="motion-rail relative w-[var(--sidebar-width)] shrink-0">
      {!collapsed && <button aria-label="Close navigation" onClick={toggle}
        className="fixed inset-x-0 bottom-0 top-14 z-20 bg-black/35 md:hidden" />}
      <aside aria-label="Workspace sidebar"
        onKeyDown={event => { if (event.key === "Escape") closeMobileNavigation(); }}
        className={cn("motion-rail absolute inset-y-0 left-0 z-30 flex flex-col border-r border-border/75 bg-[hsl(var(--nav-surface))] md:w-[var(--sidebar-width)]",
          collapsed ? "w-14" : "w-64 max-w-[90vw] shadow-xl md:shadow-none")}>
        <div className={cn("flex items-center gap-2 border-b border-border p-2", collapsed && "justify-center")}>
          {!collapsed && <div className="min-w-0 flex-1"><WorkspaceSwitcher /></div>}
          <button onClick={toggle} title={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed} className="grid h-11 w-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary">
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        {!collapsed && currentWorkspace && (
          <div className="shrink-0 border-b border-border px-3 py-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <label htmlFor="sidebar-project" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Layers3 size={14} aria-hidden="true"/>
                {t("Active project")}
              </label>
              {currentProject && (
                <span aria-hidden="true" className="max-w-full rounded border border-border px-1.5 py-0.5 text-xs font-mono text-muted-foreground [overflow-wrap:anywhere]">
                  {currentProject.project_key}
                </span>
              )}
            </div>
            {projectStatus === "error" ? <p role="alert" className="text-sm">Could not load projects. <button className="underline" onClick={() => void refreshProjects()}>Retry</button></p>
              : projectStatus === "loading" ? <ProjectSpinner size="sm" message="Loading projects."/>
              : projects.length === 0 ? <NavLink to="/projects" onClick={closeMobileNavigation} className="text-sm underline">No projects yet. View projects</NavLink>
              : <div className="relative">
                <SelectBox id="sidebar-project" className="sidebar-project-control" fullWidth value={currentProject?.id ?? ""}
                  title={currentProject?.name}
                  unavailableLabel={currentProject ? `${currentProject.name} (${currentProject.project_key})` : undefined}
                  onChange={event => setCurrentProject(projects.find(project => project.id === event.target.value) ?? null)}>
                  {!currentProject && <option value="">{t("Choose project")}</option>}
                  {projects.map(project => <option key={project.id} value={project.id}>{project.name} ({project.project_key})</option>)}
                </SelectBox>
                <span aria-hidden="true" className="sidebar-project-value">
                  {currentProject?.name ?? t("Choose project")}
                </span>
              </div>}
          </div>
        )}
        <nav aria-label="Main navigation" className="workspace-nav min-h-0 flex-1 overflow-y-auto px-2 py-4">
          {groups.map((group,index) => <section key={t(group.label)} aria-label={t(group.label)}
            className={cn("space-y-1", index > 0 && "mt-5 border-t border-border pt-5")}>
            {!collapsed && <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t(group.label)}</h2>}
            {group.items.filter(item=>item.href!=="/backlog" || workflow.data?.sprints!==false).map(({ label, href, icon: Icon }) => <NavLink key={href} to={href} aria-label={t(label)} title={collapsed ? t(label) : undefined}
              onClick={closeMobileNavigation}
              className={({isActive}) => cn("relative flex min-h-10 items-center gap-3 rounded-xl text-sm transition-all duration-150",
                collapsed ? "justify-center" : "px-3",
                isActive ? "bg-primary/10 font-semibold text-primary shadow-sm" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground")}>
              <Icon size={18}/>{!collapsed && t(label)}
            </NavLink>)}
          </section>)}
        </nav>
        <footer className="space-y-3 border-t border-border p-2">
          {!collapsed && <div className="flex rounded-lg bg-secondary p-1" role="group" aria-label="Appearance">
            {themes.map(({value,label,icon:Icon}) => <button key={value} onClick={() => setTheme(value)} aria-pressed={theme === value}
              className="flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm">
              <Icon size={13}/>{t(label)}
            </button>)}
          </div>}
          {user && <div className="flex items-center justify-center gap-2">
            {!collapsed && <><Avatar name={user.name} size="md"/><div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div></>}
            <button onClick={() => setShowLogoutConfirm(true)} title="Log out" className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"><LogOut size={16}/></button>
          </div>}
        </footer>
      </aside>
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          await logout();
          setShowLogoutConfirm(false);
        }}
        title={t("Confirm logout")}
        description={t("Are you sure you want to log out? You will need to sign in again to access your account.")}
        confirmText={t("Log out")}
        cancelText={t("Cancel")}
        variant="destructive"
      />
    </div>
  );
}
