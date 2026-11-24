import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { OrganizationSettings } from "./OrganizationSettings";
import { api, request } from "../lib/api";

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ search: "?section=Templates" }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("../context/useWorkflow", () => ({
  useWorkflow: () => ({ data: undefined }),
}));
vi.mock("../context/WorkspaceContext", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "workspace", role: "Owner" },
    currentProject: undefined,
  }),
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user" } }),
}));
vi.mock("../components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("../lib/api", () => ({
  request: vi.fn().mockResolvedValue({ issues_missing_required_fields: 0 }),
  api: {
    configuration: {
      publish: vi.fn().mockResolvedValue({ revision: 2, configuration: {} }),
      history: vi.fn().mockResolvedValue([]),
    },
  },
}));
vi.mock("../context/useConfiguration", () => ({
  useConfiguration: () => ({
    isError: false,
    data: {
      revision: 1,
      configuration: {
        allow_form_overrides: false,
        restrictions: {},
        delegate_workflows: false,
        version: 1,
        brand: "Kanbrix",
        logo: "",
        accent: "#000000",
        timezone: "UTC",
        date_format: "YYYY-MM-DD",
        week_start: 1,
        types: ["Task"],
        priorities: ["Medium"],
        fields: [],
        templates: [
          {
            name: "Kanban",
            sprints: false,
            columns: [
              { name: "Todo", category: "Todo" },
              { name: "Done", category: "Done" },
            ],
            transitions: [["Todo", "Done"]],
          },
          {
            name: "Support",
            sprints: false,
            columns: [
              { name: "Triage", category: "Todo" },
              { name: "In Progress", category: "InProgress" },
              { name: "Resolved", category: "Done" },
            ],
            transitions: [["Triage", "Resolved"]],
          },
        ],
      },
    },
  }),
}));

it("reorders organization templates and template columns and publishes the new order", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OrganizationSettings />
    </QueryClientProvider>,
  );

  expect(screen.getByRole("button", { name: "Move template Kanban up" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Move template Support down" })).toBeDisabled();

  // Move Support above Kanban so Support becomes the default (first) template.
  fireEvent.click(screen.getByRole("button", { name: "Move template Support up" }));

  const templateInputs = screen.getAllByLabelText(/Template name/) as HTMLInputElement[];
  expect(templateInputs.map((el) => el.value)).toEqual(["Support", "Kanban"]);

  // Move "In Progress" column up in Support so it comes before "Triage".
  expect(screen.getByRole("button", { name: "Move column Triage up" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Move column In Progress up" }));

  const columnInputs = screen.getAllByLabelText("Column name") as HTMLInputElement[];
  expect(columnInputs.map((el) => el.value)).toEqual([
    "In Progress",
    "Triage",
    "Resolved",
    "Todo",
    "Done",
  ]);

  fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
  await waitFor(() => expect(request).toHaveBeenCalledOnce());

  fireEvent.click(screen.getByRole("button", { name: "Publish configuration" }));
  await waitFor(() => expect(api.configuration.publish).toHaveBeenCalledOnce());

  const [, payload] = vi.mocked(api.configuration.publish).mock.calls[0];
  expect(payload.configuration.templates.map((t: { name: string }) => t.name)).toEqual([
    "Support",
    "Kanban",
  ]);
  expect(payload.configuration.templates[0].columns.map((c: { name: string }) => c.name)).toEqual([
    "In Progress",
    "Triage",
    "Resolved",
  ]);
  expect(payload.configuration.templates[0].transitions).toEqual([["Triage", "Resolved"]]);
});
