import { Link } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { ProjectSpinner } from "./ProjectSpinner";

export function EmptyProjectIcon() {
  return <span aria-hidden="true" className="relative mx-auto mb-2 grid h-14 w-16 place-items-center">
    <span className="absolute inset-x-1 bottom-1 top-2 -rotate-6 rounded-lg border border-input bg-muted"/>
    <span className="relative grid h-10 w-14 place-items-center rounded-lg border border-input bg-card shadow-sm">
      <img src="/kanbrix.svg" width="24" height="24" alt=""/>
    </span>
  </span>;
}

export function ProjectEmptyState() {
  const { currentWorkspace, isLoading, projectStatus, refreshProjects } = useWorkspace();
  if (isLoading || (currentWorkspace && projectStatus === "loading")) {
    return <ProjectSpinner message="Loading projects."/>;
  }
  if (currentWorkspace && projectStatus === "error") {
    return <div role="alert" className="p-4 text-sm">Could not load projects. <button className="underline" onClick={() => void refreshProjects()}>Retry</button></div>;
  }
  return <section className="grid min-h-48 place-content-center justify-items-center gap-2 p-5 text-center">
    <EmptyProjectIcon/>
    <h2 className="text-base font-semibold">No project selected</h2>
    <p className="text-sm text-muted-foreground">{currentWorkspace ? "Choose a project from the sidebar or open the projects page." : "Select or create a workspace to get started."}</p>
    {currentWorkspace && <Link to="/projects" className="py-2 text-sm font-medium text-primary underline">View projects</Link>}
  </section>;
}
