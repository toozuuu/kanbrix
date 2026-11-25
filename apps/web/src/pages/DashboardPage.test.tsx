import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { api } from "../lib/api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("./PersonalSettings", () => ({
  useCalendar: () => ({ day: () => "2026-11-25" }),
}));
vi.mock("../components/Reports", () => ({
  default: () => <div data-testid="reports-stub" />,
}));
vi.mock("../components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("../context/WorkspaceContext", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "ws-1", name: "Acme Corp" },
    currentProject: { id: "proj-1", name: "Core API", project_key: "CORE" },
  }),
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "Ada Lovelace" } }),
}));
vi.mock("../lib/api", () => ({
  api: {
    issues: {
      counts: vi.fn().mockResolvedValue({
        total: 10,
        assigned: 2,
        in_progress: 3,
        completed: 5,
      }),
      deadlines: vi.fn().mockResolvedValue({
        overdue_count: 25,
        items: [{
          id: "iss-1",
          identifier: "CORE-12",
          title: "Fix webhook retry backoff",
          due_date: "2026-11-20T00:00:00Z",
        }],
      }),
      get: vi.fn().mockResolvedValue({ id: "iss-1", identifier: "CORE-12" }),
      list: vi.fn().mockResolvedValue([
          {
            id: "iss-2",
            identifier: "CORE-15",
            title: "Optimize dashboard layout",
            priority: "medium",
            type: "feature",
            labels: [],
          },
      ]),
    },
    workspaces: {
      activity: vi.fn().mockResolvedValue([
        {
          id: "act-1",
          actor_name: "Ada Lovelace",
          action: "updated",
          entity_type: "issue",
          metadata: { title: "CORE-15" },
          created_at: "2026-11-25T00:00:00Z",
        },
      ]),
    },
  },
}));

it("renders KPI cards, overdue deadlines, assigned issues, and triggers callbacks", async () => {
  const onOpenCreateIssue = vi.fn();
  const onSelectIssue = vi.fn();

  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <DashboardPage
          onOpenCreateIssue={onOpenCreateIssue}
          onSelectIssue={onSelectIssue}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: "Welcome back, Ada" })).toBeInTheDocument();
  expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  expect(screen.getByText("Core API")).toBeInTheDocument();

  await waitFor(() => expect(screen.getByText("50%")).toBeInTheDocument());
  expect(screen.getByRole("progressbar", { name: "Completion progress" })).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  expect(await screen.findByText("25 overdue")).toBeInTheDocument();
  expect(screen.getByText("Overdue · 2026-11-20")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /New Issue/ }));
  expect(onOpenCreateIssue).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: /Optimize dashboard layout/ }));
  expect(onSelectIssue).toHaveBeenCalledWith(
    expect.objectContaining({ id: "iss-2", identifier: "CORE-15" }),
  );

  fireEvent.click(screen.getByRole("button", { name: /Fix webhook retry backoff/ }));
  await waitFor(() => expect(onSelectIssue).toHaveBeenCalledWith(
    expect.objectContaining({ id: "iss-1", identifier: "CORE-12" }),
  ));
  fireEvent.click(screen.getByRole("checkbox", { name: "Only my issues" }));
  await waitFor(() => expect(api.issues.deadlines).toHaveBeenCalledWith("proj-1", "2026-11-25", true));
  expect(api.issues.counts).toHaveBeenCalledOnce();
});
