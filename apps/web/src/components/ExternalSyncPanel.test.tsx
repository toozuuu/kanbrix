import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ExternalSyncPanel } from "./ExternalSyncPanel";
import { issuesToCsv, parseImportFile } from "../lib/syncParsers";
import { request } from "../lib/api";

vi.mock("../context/WorkspaceContext", () => ({
  useWorkspace: () => ({
    projects: [{ id: "p-1", name: "Existing App", project_key: "APP" }],
    currentProject: { id: "p-1", name: "Existing App", project_key: "APP" },
    refreshProjects: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("./ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("../lib/api", () => ({
  request: vi.fn(),
  api: { issues: { list: vi.fn().mockResolvedValue([]) } },
}));

describe("syncParsers", () => {
  it("parses CSV exports and normalizes types, priorities, and labels", () => {
    const csv = [
      "Key,Summary,Issue Type,Priority,Status,Labels",
      'ENG-12,"Fix, login redirect",Bug,Highest,In Progress,"auth;urgent"',
    ].join("\n");

    const parsed = parseImportFile("jira-export.csv", csv);
    expect(parsed.project_key).toBe("JIRAEXPO");
    expect(parsed.statuses).toEqual(["In Progress"]);
    expect(parsed.issues).toEqual([
      {
        external_id: "ENG-12",
        title: "Fix, login redirect",
        description: null,
        issue_type: "bug",
        priority: "critical",
        status: "In Progress",
        labels: ["auth", "urgent"],
      },
    ]);
  });

  it("serializes issues to escaped CSV", () => {
    const csv = issuesToCsv([
      {
        identifier: "APP-1",
        title: 'Quote "test"',
        description: "Body",
        type: "task",
        priority: "medium",
        status_name: "Todo",
        labels: [{ name: "backend" }],
      },
    ]);
    expect(csv).toContain('"Quote ""test"""');
    expect(csv).toContain('"backend"');
  });
});

describe("ExternalSyncPanel", () => {
  it("fetches Jira preview, allows status mapping, and imports tickets", async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({
        provider: "jira",
        project_name: "Platform",
        project_key: "PLAT",
        statuses: ["QA Review"],
        issues: [
          {
            external_id: "PLAT-1",
            title: "Migrate auth tokens",
            description: null,
            issue_type: "feature",
            priority: "high",
            status: "QA Review",
            labels: ["security"],
          },
        ],
      })
      .mockResolvedValueOnce({
        project_id: "p-2",
        project_key: "PLAT",
        imported_count: 1,
      });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExternalSyncPanel workspaceId="ws-1" />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Jira Base URL"), {
      target: { value: "https://acme.atlassian.net" },
    });
    fireEvent.change(screen.getByLabelText("Jira API Token"), {
      target: { value: "secret-token" },
    });
    fireEvent.change(screen.getByLabelText("Jira Project Key"), {
      target: { value: "PLAT" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Fetch & Preview Tickets/ }));

    await waitFor(() =>
      expect(screen.getByText(/Preview: 1 tickets ready to sync/)).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Map status QA Review" }), {
      target: { value: "In Review" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sync 1 Tickets to Kanbrix/ }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Synced 1 tickets into PLAT."),
    );
    expect(request).toHaveBeenLastCalledWith(
      "/workspaces/ws-1/sync/import",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"QA Review":"In Review"'),
      }),
    );
  });
});
