import { ProjectEmptyState } from "../components/ui/ProjectEmptyState";
import { SelectBox } from "../components/ui/SelectBox";
import {useTranslation} from "react-i18next";
import {useLiveBoard} from "../context/useLiveBoard";
import { useIssueForm } from "../context/useIssueForm";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCalendar } from "./PersonalSettings";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { api } from "../lib/api";
import { Issue } from "../types";
import { KanbanBoard } from "../components/kanban/KanbanBoard";
import { FilterBar } from "../components/issues/FilterBar";
import { Button } from "../components/ui/Button";
import { ProjectSpinner } from "../components/ui/ProjectSpinner";
import { useToast } from "../components/ui/Toast";
import { Plus, Kanban as KanbanIcon, ListTree, LayoutDashboard, Bookmark, X } from "lucide-react";

interface KanbanPageProps {
  onIssueClick: (issue: Issue) => void;
  onAddIssueToStatus: (statusId?: string) => void;
}

export function KanbanPage({ onIssueClick, onAddIssueToStatus }: KanbanPageProps) {
  const {t}=useTranslation();
  const { currentProject } = useWorkspace();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const priority = params.get("priority") ?? undefined;
  const type = params.get("type") ?? undefined;
  const assignment = params.get("assignment") ?? "";
  const recentlyUpdated = params.get("updated") === "recent";
  const overdue = params.get("due") === "overdue";
  const labelFilter = params.get("label") ?? undefined;
  const labelIdsParam = params.get("labels");
  const projectId = currentProject?.id;
  const sprintId = params.get("sprint") ?? "";
  const [groupBy, setGroupBy] = useState<"none" | "assignee" | "priority">("none");
  const [filterName, setFilterName] = useState("");
  const [savingFilter, setSavingFilter] = useState(false);
  const client = useQueryClient();
  const { toast } = useToast();
  const savedFilters = useQuery({
    queryKey: ["saved-filters", projectId],
    queryFn: () => api.projects.filters.list(projectId!),
    enabled: !!projectId,
  });
  const sprints = useQuery({
    queryKey: ["project-sprints", projectId],
    queryFn: () => api.sprints.list(projectId!),
    enabled: !!projectId,
  });
  useLiveBoard(projectId,user?.id);
  const workflow = useQuery({
    queryKey: ["project-workflow", projectId],
    queryFn: () => api.projects.get(projectId!),
    enabled: !!projectId,
  });
  const today = useCalendar().day();
  const cfg=useIssueForm();
  const fieldId=params.get("field")??"";const fieldValue=params.get("value")??"";

  // Parse label_ids from URL parameter (comma-separated)
  const urlLabelIds = labelIdsParam ? labelIdsParam.split(',').filter(id => id.trim()) : [];
  const allActiveLabelIds = labelFilter ? [labelFilter, ...urlLabelIds.filter(id => id !== labelFilter)] : urlLabelIds;

  const filters = { recently_updated: recentlyUpdated || undefined, field_id:fieldId || undefined,field_value:fieldValue || undefined,search, priority, type, assignee_id: assignment === "mine" ? user?.id : undefined,
    unassigned: assignment === "unassigned", due_before: overdue ? today + "T00:00:00Z" : undefined,
    label_id: labelFilter, label_ids: allActiveLabelIds.length > 0 ? allActiveLabelIds : undefined,
    sprint_id: sprints.data?.some(sprint => sprint.id === sprintId) ? sprintId : undefined };
  const [extraPages, setExtraPages] = useState<Record<string, number>>({});
  const pageSize = 50;
  const statuses = workflow.data?.statuses ?? [];
  const pageKey = (id: string) => JSON.stringify([projectId, filters, id]);
  const pages = statuses.flatMap(status => Array.from(
    { length: 1 + (extraPages[pageKey(status.id)] ?? 0) }, (_, page) => ({ statusId: status.id, page })
  ));
  const queries = useQueries({ queries: pages.map(({ statusId, page }) => ({
    refetchOnMount: "always" as const,
    queryKey: ["board-issues", user?.id, projectId, statusId, filters, page],
    queryFn: () => api.issues.list(projectId!, { ...filters, status_id: statusId, limit: pageSize + 1, offset: page * pageSize }),
  })) });
  const issues = Array.from(new Map(queries.flatMap(q => (q.data ?? []).slice(0, pageSize)).map(i => [i.id, i])).values());
  const nextPositions = new Map<string, number>();
  pages.forEach(({ statusId, page }, index) => {
    const next = queries[index].data?.[pageSize];
    if (next && page === (extraPages[pageKey(statusId)] ?? 0)) nextPositions.set(statusId, next.position);
  });
  const refresh = () => queries.forEach(q => { void q.refetch(); });

  const updateFilter = (key: string, value?: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const handleSelectedLabelsChange = (labelIds: string[]) => {
    const next = new URLSearchParams(params);
    if (labelIds.length > 0) {
      next.set("labels", labelIds.join(','));
      if (labelFilter) next.delete("label");
    } else {
      next.delete("labels");
      if (labelFilter) next.delete("label");
    }
    setParams(next, { replace: true });
  };

  if (!currentProject) return <ProjectEmptyState/>;

  return (
    <div className="flex min-h-full flex-col gap-3">
      {/* Top Controls Bar */}
      <div className="page-header">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{currentProject.project_key}</p>
          <h1 className="page-heading">{currentProject.name}</h1>
        </div>

        <Button size="sm" onClick={() => onAddIssueToStatus()} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>{t("New Issue")}</span>
        </Button>
      </div>
      <nav aria-label="Project views" className="flex flex-wrap items-center gap-2 text-sm">
        <span aria-current="page" className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 font-semibold text-primary">
          <KanbanIcon size={15} aria-hidden="true" /> Board
        </span>
        <Link to="/backlog" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-accent">
          <ListTree size={15} aria-hidden="true" /> Backlog
        </Link>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-accent">
          <LayoutDashboard size={15} aria-hidden="true" /> Dashboard
        </Link>
        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">
          <SelectBox aria-label="Group board by swimlane" value={groupBy} onChange={e => setGroupBy(e.target.value as "none" | "assignee" | "priority")}>
            <option value="none">No swimlanes</option>
            <option value="assignee">Swimlanes: Assignee</option>
            <option value="priority">Swimlanes: Priority</option>
          </SelectBox>
          <SelectBox fullWidth aria-label="Filter board by sprint" value={sprintId} data-filter-active={!!sprintId}
            unavailableLabel={sprints.isPending ? "Loading sprints…" : "Sprint unavailable"}
            onChange={event => updateFilter("sprint", event.target.value)}>
            <option value="">All sprints</option>
            {sprints.data?.map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
          </SelectBox>
          {sprints.isError && <button type="button" className="text-xs text-primary underline" onClick={() => void sprints.refetch()}>Retry sprints</button>}
        </div>
      </nav>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearchChange={value => updateFilter("q", value)}
        priority={priority}
        onPriorityChange={value => updateFilter("priority", value)}
        type={type}
        onTypeChange={value => updateFilter("type", value)}
        assignment={assignment}
        onAssignmentChange={value => updateFilter("assignment", value)}
        recentlyUpdated={recentlyUpdated}
        onRecentlyUpdatedChange={() => updateFilter("updated", recentlyUpdated ? undefined : "recent")}
        overdue={overdue}
        onOverdueChange={() => updateFilter("due", overdue ? undefined : "overdue")}
        selectedLabels={allActiveLabelIds}
        onSelectedLabelsChange={handleSelectedLabelsChange}
        onClear={() => {
          const next = new URLSearchParams(params);
          for (const key of ["q", "priority", "type", "assignment", "due", "updated", "field", "value", "label", "labels", "sprint"]) next.delete(key);
          setParams(next, { replace: true });
        }}
      />

      {!!cfg?.fields.length && <div className="flex flex-wrap gap-2 text-sm"><SelectBox aria-label="Filter by custom field" data-filter-active={Boolean(fieldId)} value={fieldId} onChange={e=>{const next=new URLSearchParams(params);next.delete("value");if(e.target.value)next.set("field",e.target.value);else next.delete("field");setParams(next,{replace:true});}}><option value="">All custom fields</option>{cfg.fields.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</SelectBox>{fieldId && <input aria-label="Custom field value" className="min-w-0 max-w-full rounded border border-input bg-card p-2" placeholder="Exact value" value={fieldValue} onChange={e=>updateFilter("value",e.target.value)}/>}</div>}

      {/* Saved Quick Filters */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {savedFilters.data?.map((f) => (
          <span
            key={f.id}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 shadow-sm"
          >
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams();
                Object.entries(f.query_params).forEach(([k, v]) => {
                  if (v) next.set(k, v);
                });
                setParams(next, { replace: true });
              }}
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
            >
              <Bookmark className="h-3 w-3 text-primary" aria-hidden="true" />
              {f.name}
            </button>
            <button
              type="button"
              aria-label={`Remove saved filter ${f.name}`}
              onClick={async () => {
                await api.projects.filters.delete(projectId!, f.id);
                await client.invalidateQueries({ queryKey: ["saved-filters", projectId] });
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        {Array.from(params.keys()).length > 0 && (
          <form
            className="inline-flex items-center gap-1.5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!filterName.trim() || !projectId) return;
              setSavingFilter(true);
              try {
                const query_params: Record<string, string> = {};
                params.forEach((v, k) => {
                  query_params[k] = v;
                });
                await api.projects.filters.create(projectId, {
                  name: filterName.trim(),
                  query_params,
                });
                setFilterName("");
                await client.invalidateQueries({ queryKey: ["saved-filters", projectId] });
                toast("Quick filter saved", "success");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Could not save filter", "error");
              } finally {
                setSavingFilter(false);
              }
            }}
          >
            <input
              aria-label="Quick filter name"
              placeholder="Save filter as…"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="h-8 w-36 rounded-lg border border-input bg-card px-2.5 text-xs"
            />
            <Button type="submit" size="xs" variant="secondary" isLoading={savingFilter}>
              Save
            </Button>
          </form>
        )}
      </div>
      {/* Kanban Board Canvas */}
      <div className="relative">
        {queries.some(q => q.isFetching && !q.isPending) && (
          <div className="absolute top-2 right-4 z-20 pointer-events-none flex items-center gap-2 rounded-full border border-primary/30 bg-card/95 px-3 py-1 shadow-md backdrop-blur-md text-xs font-medium text-foreground animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Syncing project…
          </div>
        )}
        {queries.some(q => q.isError) || workflow.isError ? (
          <div className="flex h-96 flex-col items-center justify-center text-center space-y-3">
            <p className="text-sm text-destructive font-medium">Could not load board.</p>
            <button className="text-sm font-semibold text-primary underline" onClick={() => { refresh(); workflow.refetch(); }}>Retry</button>
          </div>
        ) : queries.some(q => q.isPending) || workflow.isPending ? (
          <ProjectSpinner
            message="Loading board…"
            subMessage={currentProject?.name ? `Refreshing ${currentProject.name}` : "Fetching board columns and issues"}
          />
        ) : groupBy === "none" ? <KanbanBoard
          key={projectId}
          statuses={workflow.data.statuses ?? []}
          issues={issues}
          nextPositions={nextPositions}
          loadMore={id => setExtraPages(old => ({ ...old, [pageKey(id)]: (old[pageKey(id)] ?? 0) + 1 }))}
          onIssueClick={onIssueClick}
          onAddIssueToStatus={(statusId) => onAddIssueToStatus(statusId)}
          onRefresh={refresh}
        /> : (
          <div className="space-y-6 pr-1">
            {Array.from(
              issues.reduce((acc, issue) => {
                const key = groupBy === "assignee"
                  ? (issue.assignee_name || "Unassigned")
                  : (issue.priority || "medium");
                const list = acc.get(key) ?? [];
                list.push(issue);
                acc.set(key, list);
                return acc;
              }, new Map<string, Issue[]>()),
            ).map(([lane, laneIssues]) => (
              <div key={lane} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <h2 className="text-sm font-semibold capitalize text-foreground">{lane}</h2>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {laneIssues.length}
                  </span>
                </div>
                <KanbanBoard
                  key={`${projectId}-${lane}`}
                  statuses={workflow.data.statuses ?? []}
                  issues={laneIssues}
                  nextPositions={new Map()}
                  loadMore={() => {}}
                  onIssueClick={onIssueClick}
                  onAddIssueToStatus={(statusId) => onAddIssueToStatus(statusId)}
                  onRefresh={refresh}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
