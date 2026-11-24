import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { WorkflowSettings } from "./WorkflowSettings";
import { request } from "../lib/api";

vi.mock("../context/useWorkflow", () => ({useWorkflow: () => ({data: {
  revision: 3, editable: true, admin: false, delegates: [], transitions: [], sprints: true,
  form: {}, columns: [
    {id:"a", name:"Ready", category:"Todo", issues:2},
    {id:"b", name:"Queued", category:"Todo", issues:4},
    {id:"c", name:"Review", category:"InReview", issues:1},
  ],
}})}));
vi.mock("../context/useConfiguration", () => ({useConfiguration: () => ({data:{configuration:{
  templates:[{name:"Support", sprints:false, columns:[
    {name:"Inbox",category:"Todo"}, {name:"Ready",category:"Todo"},
  ], transitions:[["Inbox","Ready"]]}],
}}})}));
vi.mock("../context/WorkspaceContext", () => ({useWorkspace: () => ({
  currentWorkspace:{id:"workspace"}, currentProject:{id:"project",name:"Support desk"},
})}));
vi.mock("../context/AuthContext", () => ({useAuth: () => ({user:{id:"user"}})}));
vi.mock("../components/ui/Toast", () => ({useToast: () => ({toast:vi.fn()})}));
vi.mock("../lib/api", () => ({request:vi.fn().mockResolvedValue(true),api:{}}));

it("applies the selected template, keeps matching issues, and publishes the reviewed migration", async () => {
  render(<QueryClientProvider client={new QueryClient()}><WorkflowSettings/></QueryClientProvider>);
  const picker = screen.getByRole("combobox", {name:/Apply organization template/});
  fireEvent.change(picker, {target:{value:"Support"}});
  expect(picker).toHaveValue("Support");
  expect(screen.getByText(/Support applied to the draft/)).toBeVisible();
  const preview = screen.getByRole("button",{name:"Preview workflow"});
  expect(preview).toBeDisabled();
  fireEvent.change(screen.getByRole("combobox",{name:/Move 1 issues from Review/}), {target:{value:"a"}});
  fireEvent.click(preview);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Publish workflow"}));
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  const [path, options] = vi.mocked(request).mock.calls[0];
  expect(path).toBe("/projects/project/workflow");
  expect(JSON.parse(String(options?.body))).toMatchObject({
    revision:3, sprints:false, transitions:[["b","a"]], replacements:{c:"a"},
    columns:[{id:"b",name:"Inbox"},{id:"a",name:"Ready"}],
  });
});
