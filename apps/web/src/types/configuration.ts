export type FieldValue = string | number | string[] | null;
export type Values = Record<string, FieldValue>;
export interface CustomField {
  help?: string;
  option_labels?: Record<string, string>;
  id: string;
  label: string;
  kind: string;
  required: boolean;
  issue_type: string;
  options: string[];
}
export interface WorkflowColumn {
  name: string;
  category: string;
}
export interface FormOverrides {
  hidden_fields: string[];
  types: string[];
  priorities: string[];
}
export interface Template {
  transitions?: string[][];
  form?: FormOverrides;
  name: string;
  columns: WorkflowColumn[];
  sprints: boolean;
}
export interface Configuration {
  allow_form_overrides: boolean;
  restrictions: Record<string, string[]>;
  delegate_workflows: boolean;
  version: number;
  brand: string;
  logo: string;
  accent: string;
  timezone: string;
  date_format: string;
  week_start: number;
  types: string[];
  priorities: string[];
  fields: CustomField[];
  templates: Template[];
}
export interface Snapshot {
  revision: number;
  configuration: Configuration;
}
