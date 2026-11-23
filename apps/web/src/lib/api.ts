import {
  ActivityLog,
  Comment,
  Issue,
  Label,
  Notification,
  Project,
  Sprint,
  User,
  Workspace,
  WorkspaceMember,
} from "../types";

import type { Snapshot, Values } from "../types/configuration";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("/api") ? endpoint : `/api/v1${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // essential for cookies
  });

  if (response.status === 204) {
    return {} as T;
  }

  let data: any;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorDetails = data?.error;
    throw new ApiError(
      response.status,
      errorDetails?.code || "REQUEST_FAILED",
      errorDetails?.message || (typeof data === "string" ? data : "An error occurred"),
      errorDetails?.details
    );
  }

  return data as T;
}

export const api = {
  configuration: {
    validate:(ws:string,body:Snapshot['configuration'])=>request<boolean>(`/workspaces/${ws}/configuration/validate`,{method:'POST',body:JSON.stringify(body)}),
    read: (ws:string)=>request<Snapshot>(`/workspaces/${ws}/configuration`),
    publish:(ws:string,body:Snapshot)=>request<Snapshot>(`/workspaces/${ws}/configuration`,{method:"PUT",body:JSON.stringify(body)}),
    history:(ws:string)=>request<(Snapshot & {author:string;created_at:string})[]>(`/workspaces/${ws}/configuration/history`),
  },
  // Auth
  auth: {
    me: () => request<User>("/auth/me"),
    register: (body: { name: string; email: string; password: string }) =>
      request<{ user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    login: (body: { email: string; password: string }) =>
      request<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
  },

  // Workspaces
  workspaces: {
    list: () => request<Workspace[]>("/workspaces"),
    create: (body: { name: string; slug: string }) =>
      request<Workspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    get: (workspaceId: string) => request<Workspace>(`/workspaces/${workspaceId}`),
    update: (workspaceId: string, body: { name?: string }) =>
      request<Workspace>(`/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    members: (workspaceId: string) =>
      request<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`),
    invite: (workspaceId: string, body: { email: string; role: string }) =>
      request<void>(`/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    activity: (workspaceId: string, issueId?: string) =>
      request<ActivityLog[]>(`/workspaces/${workspaceId}/activity${issueId ? "?issue_id=" + encodeURIComponent(issueId) : ""}`),
  },

  // Projects
  projects: {
    list: (workspaceId: string) =>
      request<Project[]>(`/workspaces/${workspaceId}/projects`),
    create: (workspaceId: string, body: { name: string; project_key: string; template?:string; description?: string }) =>
      request<Project>(`/workspaces/${workspaceId}/projects`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    get: (projectId: string) => request<Project>(`/projects/${projectId}`),
    update: (projectId: string, body: { name?: string; description?: string }) =>
      request<Project>(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },

  // Issues
  issues: {
    counts: (projectId: string) =>
      request<{ total: number; assigned: number; in_progress: number; completed: number }>(`/projects/${projectId}/issue-counts`),
    list: (
      projectId: string,
      filters: {
        status_id?: string;
        assignee_id?: string;
        type?: string;
        priority?: string;
        sprint_id?: string;
        search?: string;
        limit?: number;
        offset?: number;
        field_id?:string;field_value?:string;
        recently_updated?: boolean;
        due_before?: string;
        unassigned?: boolean;
        label_id?: string;
        label_ids?: string[];
      } = {}
    ) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== "") {
          if (Array.isArray(v)) {
            v.forEach(item => params.append(k, String(item)));
          } else {
            params.append(k, String(v));
          }
        }
      });
      const qs = params.toString();
      return request<Issue[]>(`/projects/${projectId}/issues${qs ? `?${qs}` : ""}`);
    },
    create: (
      projectId: string,
      body: {
        title: string;
        description?: string;
        type?: string;
        priority?: string;
        status_id: string;
        assignee_id?: string | null;
        sprint_id?: string | null;
        custom_values?: Values;
        due_date?: string | null;
        labels?: string[];
      }
    ) =>
      request<Issue>(`/projects/${projectId}/issues`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    get: (issueId: string) => request<Issue>(`/issues/${issueId}`),
    update: (
      issueId: string,
      body: {
        title?: string;
        description?: string;
        type?: string;
        priority?: string;
        status_id?: string;
        assignee_id?: string | null;
        sprint_id?: string | null;
        custom_values?: Values;
        due_date?: string | null;
        labels?: string[];
      }
    ) =>
      request<Issue>(`/issues/${issueId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    reorder: (issueId: string, body: { status_id: string; position: number }) =>
      request<void>(`/issues/${issueId}/reorder`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    delete: (issueId: string) => request<void>(`/issues/${issueId}`, { method: "DELETE" }),
  },

  // Comments
  comments: {
    list: (issueId: string) => request<Comment[]>(`/issues/${issueId}/comments`),
    create: (issueId: string, body: { body: string }) =>
      request<Comment>(`/issues/${issueId}/comments`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  // Sprints
  sprints: {
    list: (projectId: string) => request<Sprint[]>(`/projects/${projectId}/sprints`),
    create: (
      projectId: string,
      body: { name: string; goal?: string; start_date?: string; end_date?: string }
    ) =>
      request<Sprint>(`/projects/${projectId}/sprints`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    start: (sprintId: string) =>
      request<void>(`/sprints/${sprintId}/start`, { method: "POST" }),
    complete: (sprintId: string) =>
      request<void>(`/sprints/${sprintId}/complete`, { method: "POST" }),
  },

  // Notifications
  notifications: {
    list: () => request<Notification[]>("/notifications"),
    markRead: (id: string) =>
      request<void>(`/notifications/${id}/read`, { method: "POST" }),
  },

  // Labels
  labels: {
    list: (workspaceId: string) =>
      request<Label[]>(`/workspaces/${workspaceId}/labels`),
    create: (workspaceId: string, body: { name: string; color?: string }) =>
      request<Label>(`/workspaces/${workspaceId}/labels`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    delete: (labelId: string) =>
      request<void>(`/labels/${labelId}`, { method: "DELETE" }),
  },

  // Issue Labels
  issueLabels: {
    list: (issueId: string) =>
      request<Label[]>(`/issues/${issueId}/labels`),
    set: (issueId: string, labelIds: string[]) =>
      request<void>(`/issues/${issueId}/labels`, {
        method: "POST",
        body: JSON.stringify(labelIds),
      }),
  },
};
