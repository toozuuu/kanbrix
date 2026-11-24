export type User = {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  created_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  role: 'Owner' | 'Admin' | 'Member' | 'Viewer';
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  role: 'Owner' | 'Admin' | 'Member' | 'Viewer';
  joined_at: string;
};

export type IssueStatus = {
  id: string;
  name: string;
  category: 'Backlog' | 'Todo' | 'InProgress' | 'InReview' | 'Done';
  position: number;
  wip_limit?: number | null;
};

export type Project = {
  id: string;
  workspace_id: string;
  name: string;
  project_key: string;
  description?: string | null;
  issue_counter: number;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  statuses?: IssueStatus[];
};

export type IssueType = 'Task' | 'Bug' | 'Story' | 'Epic';
export type IssuePriority = 'Lowest' | 'Low' | 'Medium' | 'High' | 'Urgent';

export type Label = {
  id: string;
  workspace_id?: string;
  name: string;
  color: string;
};

export type LabelResponse = Label;

export type Issue = {
  custom_values?: import('./configuration').Values;
  id: string;
  project_id: string;
  project_key: string;
  issue_number: number;
  identifier: string; // e.g. "CORE-42"
  title: string;
  description?: string | null;
  type: IssueType;
  priority: IssuePriority;
  status_id: string;
  status_name: string;
  status_category: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  reporter_id: string;
  reporter_name: string;
  parent_issue_id?: string | null;
  sprint_id?: string | null;
  story_points?: number | null;
  position: number;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  labels: Label[];
};

export type SubtaskSummary = {
  id: string;
  identifier: string;
  title: string;
  priority: string;
  status_name: string;
  status_category: string;
};

export type LinkedIssueSummary = {
  id: string;
  link_type: 'blocks' | 'is_blocked_by' | 'relates_to' | 'duplicates';
  issue_id: string;
  identifier: string;
  title: string;
  status_name: string;
};

export type IssueRelations = {
  subtasks: SubtaskSummary[];
  links: LinkedIssueSummary[];
};

export type SavedFilter = {
  id: string;
  name: string;
  query_params: Record<string, string>;
};

export type Comment = {
  id: string;
  issue_id: string;
  author_id: string;
  author_name: string;
  author_avatar_url?: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type Sprint = {
  id: string;
  project_id: string;
  name: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: 'planned' | 'active' | 'completed';
  created_at: string;
};

export type Notification = {
  id: string;
  recipient_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  type: string;
  payload: Record<string, any>;
  read_at?: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  workspace_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
};

export type Attachment = {
  id: string;
  filename: string;
  size: number;
};
