import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { MembersPage } from "./MembersPage";
import { api } from "../lib/api";

let workspace = "A";
vi.mock("../context/WorkspaceContext", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: workspace, name: workspace } }),
}));
vi.mock("../components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

it("keeps the selected workspace's members when an older request finishes last", async () => {
  const member = (name: string) => ({
    user_id: name, name, email: name + "@example.test", role: "Member" as const,
    joined_at: "2026-01-01",
  });
  type List = Awaited<ReturnType<typeof api.workspaces.members>>;
  let finishFirst!: (rows: List) => void;
  const first = new Promise<List>(resolve => { finishFirst = resolve; });
  const request = vi.spyOn(api.workspaces, "members")
    .mockImplementation(id => id === "A" ? first : Promise.resolve([member("Bea")]));
  const client = new QueryClient();
  const page = () => <QueryClientProvider client={client}><MembersPage/></QueryClientProvider>;
  try {
    const view = render(page());
    expect(request).toHaveBeenCalledWith("A");
    workspace = "B";
    view.rerender(page());
    await screen.findByText("Bea");
    await act(async () => { finishFirst([member("Ana")]); await first; });
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    expect(screen.getByText("Bea")).toBeInTheDocument();
  } finally {
    request.mockRestore();
    client.clear();
    workspace = "A";
  }
});
