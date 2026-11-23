/**
 * RustTrack Generated API Contract Definitions
 * Synchronized with backend Axum OpenAPI routes.
 */

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectResponse {
  id: string;
  workspace_id: string;
  name: string;
  project_key: string;
  description?: string | null;
  issue_counter: number;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssueResponse {
  id: string;
  project_id: string;
  project_key: string;
  issue_number: number;
  identifier: string;
  title: string;
  description?: string | null;
  type: string;
  priority: string;
  status_id: string;
  status_name: string;
  status_category: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  reporter_id: string;
  reporter_name: string;
  parent_issue_id?: string | null;
  sprint_id?: string | null;
  position: number;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
}
