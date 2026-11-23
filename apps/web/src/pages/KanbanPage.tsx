import { SelectBox } from "../components/ui/SelectBox";
import {useTranslation} from "react-i18next";
import {useLiveBoard} from "../context/useLiveBoard";
import { useIssueForm } from "../context/useIssueForm";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useCalendar } from "./PersonalSettings";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { api } from "../lib/api";
import { Issue } from "../types";
import { KanbanBoard } from "../components/kanban/KanbanBoard";
import { FilterBar } from "../components/issues/FilterBar";
import { Button } from "../components/ui/Button";
import { Plus, Kanban as KanbanIcon } from "lucide-react";

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
    label_id: labelFilter, label_ids: allActiveLabelIds.length > 0 ? allActiveLabelIds : undefined };
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

  if (!currentProject) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center space-y-3">
        <KanbanIcon className="h-10 w-10 text-muted-foreground/60" />
        <h2 className="text-base font-semibold text-foreground">No Project Selected</h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          Please select a project from the sidebar or create a new project in your workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <div>
          <h1 className="text-base font-bold text-foreground tracking-tight">{t("Kanban Board")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {currentProject.name} &middot; {issues.length} issues shown
          </p>
        </div>

        <Button size="sm" onClick={() => onAddIssueToStatus()} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>{t("New Issue")}</span>
        </Button>
      </div>

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
          for (const key of ["q", "priority", "type", "assignment", "due", "updated", "field", "value", "label", "labels"]) next.delete(key);
          setParams(next, { replace: true });
        }}
      />

      {!!cfg?.fields.length && <div className="flex flex-wrap gap-2 text-sm"><SelectBox aria-label="Filter by custom field" data-filter-active={Boolean(fieldId)} value={fieldId} onChange={e=>{const next=new URLSearchParams(params);next.delete("value");if(e.target.value)next.set("field",e.target.value);else next.delete("field");setParams(next,{replace:true});}}><option value="">All custom fields</option>{cfg.fields.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</SelectBox>{fieldId && <input aria-label="Custom field value" className="min-w-0 max-w-full rounded border border-input bg-card p-2" placeholder="Exact value" value={fieldValue} onChange={e=>updateFilter("value",e.target.value)}/>}</div>}
      {/* Kanban Board Canvas */}
      <div className="flex-1 overflow-hidden min-h-0">
        {queries.some(q => q.isError) || workflow.isError ? (
          <button className="text-primary underline" onClick={() => { refresh(); workflow.refetch(); }}>Could not load board. Retry</button>
        ) : queries.some(q => q.isPending) || workflow.isPending ? <p role="status">Loading board…</p> : <KanbanBoard
          key={projectId}
          statuses={workflow.data.statuses ?? []}
          issues={issues}
          nextPositions={nextPositions}
          loadMore={id => setExtraPages(old => ({ ...old, [pageKey(id)]: (old[pageKey(id)] ?? 0) + 1 }))}
          onIssueClick={onIssueClick}
          onAddIssueToStatus={(statusId) => onAddIssueToStatus(statusId)}
          onRefresh={refresh}
        />}
      </div>
    </div>
  );
}
