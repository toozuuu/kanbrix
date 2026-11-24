import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ProjectEmptyState } from "./ProjectEmptyState";

const workspace = { currentWorkspace: { id: "A" }, isLoading: false, projectStatus: "loading", refreshProjects: vi.fn() };
vi.mock("../../context/WorkspaceContext", () => ({ useWorkspace: () => workspace }));

it("waits for the project request before offering empty-state navigation", () => {
  const page = () => <MemoryRouter><ProjectEmptyState/></MemoryRouter>;
  const view = render(page());
  expect(screen.getByRole("status")).toHaveTextContent("Loading projects");
  expect(screen.queryByRole("link")).toBeNull();
  workspace.projectStatus = "error";
  view.rerender(page());
  screen.getByRole("button", { name: "Retry" }).click();
  expect(workspace.refreshProjects).toHaveBeenCalledOnce();
  workspace.projectStatus = "ready";
  view.rerender(page());
  expect(screen.getByRole("link", { name: "View projects" })).toHaveAttribute("href", "/projects");
});
