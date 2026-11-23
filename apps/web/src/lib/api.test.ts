import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";

const id = "70000000-0000-4000-8000-000000000024";
const labelId = "90000000-0000-4000-8000-000000000002";
const login = { email: "alex@example.test", password: "Mock-only-pass-24" };
const account = { ...login, name: "Alex" };
const workspace = { name: "Platform", slug: "platform" };
const project = { name: "Payments", project_key: "PAY" };
const issue = { title: "Retry failed invoice", status_id: id };
const sprint = { name: "February sprint", start_date: "2028-02-21", end_date: "2028-02-29" };
const comment = { body: "Retry confirmed in staging." };
const invite = { email: "lee@example.test", role: "Member" };

type RequestCase = [string, string, string, () => Promise<unknown>, unknown?];
const cases: RequestCase[] = [
  ["register", "POST", "/auth/register", () => api.auth.register(account), account],
  ["login", "POST", "/auth/login", () => api.auth.login(login), login],
  ["logout", "POST", "/auth/logout", api.auth.logout],
  ["session", "GET", "/auth/me", api.auth.me],
  ["create workspace", "POST", "/workspaces", () => api.workspaces.create(workspace), workspace],
  ["invite member", "POST", `/workspaces/${id}/invitations`, () => api.workspaces.invite(id, invite), invite],
  ["read configuration", "GET", `/workspaces/${id}/configuration`, () => api.configuration.read(id)],
  ["create project", "POST", `/workspaces/${id}/projects`, () => api.projects.create(id, project), project],
  ["create issue", "POST", `/projects/${id}/issues`, () => api.issues.create(id, issue), issue],
  ["edit issue", "PATCH", `/issues/${id}`, () => api.issues.update(id, issue), issue],
  ["delete issue", "DELETE", `/issues/${id}`, () => api.issues.delete(id)],
  ["comment", "POST", `/issues/${id}/comments`, () => api.comments.create(id, comment), comment],
  ["create sprint", "POST", `/projects/${id}/sprints`, () => api.sprints.create(id, sprint), sprint],
  ["start sprint", "POST", `/sprints/${id}/start`, () => api.sprints.start(id)],
  ["complete sprint", "POST", `/sprints/${id}/complete`, () => api.sprints.complete(id)],
  ["read workspace labels", "GET", `/workspaces/${id}/labels`, () => api.labels.list(id)],
  ["apply label", "POST", `/issues/${id}/labels`, () => api.issueLabels.set(id, [labelId]), [labelId]],
  ["read notification", "POST", `/notifications/${id}/read`, () => api.notifications.markRead(id)],
];
afterEach(() => vi.unstubAllGlobals());

it.each(cases)("%s sends the expected authenticated request", async (_, method, path, run, body) => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  await run();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/v1" + path);
  expect(init?.method ?? "GET").toBe(method);
  expect(init?.credentials).toBe("include");
  expect(init?.body).toBe(JSON.stringify(body));
});

it("propagates an expired session with the server message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
    { error: { code: "UNAUTHORIZED", message: "Session expired" } }, { status: 401 },
  )));
  await expect(api.auth.me()).rejects.toMatchObject({ status: 401, message: "Session expired" });
});
