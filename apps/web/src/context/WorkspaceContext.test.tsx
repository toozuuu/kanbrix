import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";

const mocks = vi.hoisted(() => ({
  user: {id:"test-user"},
  workspaces: vi.fn(),
  projects: vi.fn(),
}));
vi.mock("./AuthContext", () => ({useAuth: () => ({user:mocks.user})}));
vi.mock("../lib/api", () => ({api:{
  workspaces:{list:mocks.workspaces}, projects:{list:mocks.projects},
}}));

function Switcher() {
  const ctx = useWorkspace();
  return <>
    <button onClick={() => ctx.setCurrentWorkspace(ctx.workspaces[1])}>Switch workspace</button>
    <output>{ctx.currentProject?.name ?? "No project"}</output>
  </>;
}

beforeEach(() => localStorage.clear());
it("ignores a previous workspace project list arriving after a switch", async () => {
  const oldProject = {id:"old",workspace_id:"a",name:"Old project"};
  let finish!: (projects: typeof oldProject[]) => void;
  const delayed = new Promise<typeof oldProject[]>(resolve => {finish=resolve;});
  mocks.workspaces.mockResolvedValue([{id:"a"},{id:"b"}]);
  mocks.projects.mockImplementation((id: string) => id==="a" ? delayed :
    Promise.resolve([{id:"new",workspace_id:"b",name:"Current project"}]));
  render(<WorkspaceProvider><Switcher/></WorkspaceProvider>);
  await waitFor(() => expect(mocks.projects).toHaveBeenCalledWith("a"));
  fireEvent.click(screen.getByText("Switch workspace"));
  await screen.findByText("Current project");
  await act(async () => { finish([oldProject]); await delayed; });
  expect(screen.getByRole("status")).toHaveTextContent("Current project");
});
