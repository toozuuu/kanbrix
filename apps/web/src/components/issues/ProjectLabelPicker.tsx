import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "../../context/WorkspaceContext";
import { api } from "../../lib/api";
import type { Label } from "../../types";
import { LabelBadge } from "../ui/LabelBadge";
import { ProjectSpinner } from "../ui/ProjectSpinner";

const labelKey = (workspace?: string, project?: string) => ["project-labels", workspace, project];

export function useProjectLabels(enabled = true) {
  const { currentWorkspace, currentProject } = useWorkspace();
  return useQuery({
    queryKey: labelKey(currentWorkspace?.id, currentProject?.id),
    enabled: enabled && !!currentProject && currentProject.workspace_id === currentWorkspace?.id,
    queryFn: () => api.labels.list(currentWorkspace!.id, currentProject!.id),
  });
}

interface PickerProps {
  selected: string[];
  toggle: (id: string) => void;
  add: (id: string) => void;
}

export function ProjectLabelPicker(props: PickerProps) {
  const { currentWorkspace, currentProject } = useWorkspace();
  if (!currentWorkspace || currentProject?.workspace_id !== currentWorkspace.id) return null;
  return <Picker key={currentProject.id} {...props} project={currentProject.id} workspace={currentWorkspace.id}
    canCreate={["Owner","Admin"].includes(currentWorkspace.role)}/>;
}

function Picker({ selected, toggle, add, workspace, project, canCreate }: PickerProps & {
  workspace: string; project: string; canCreate: boolean;
}) {
  const query = useProjectLabels();
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const label = await api.labels.create(workspace, { project_id: project, name: name.trim() });
      const key = labelKey(workspace, project);
      await client.cancelQueries({queryKey: key, exact: true});
      client.setQueryData<Label[]>(key, old => [...(old ?? []).filter(l => l.id !== label.id), label]
        .sort((a,b) => a.name.localeCompare(b.name)));
      void client.invalidateQueries({queryKey: key, exact: true});
      if (mounted.current) { add(label.id); setName(""); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not add label.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return <div className="space-y-2">
    {query.isPending ? <ProjectSpinner size="sm" message="Loading project labels."/> :
      query.isError ? <p role="alert">Could not load labels. <button type="button" className="underline" onClick={() => void query.refetch()}>Retry</button></p> :
      query.data?.length ? <div className="flex flex-wrap gap-2">
        {query.data.map(label => <label key={label.id} className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={selected.includes(label.id)} onChange={() => toggle(label.id)}/>
          <LabelBadge label={label}/>
        </label>)}
      </div> : <p className="text-sm text-muted-foreground">No labels in this project yet.</p>}
    {canCreate && <div className="flex flex-wrap gap-2">
      <input aria-label="New project label" placeholder="New label name" maxLength={64} value={name} disabled={busy}
        className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm"
        onChange={event => setName(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void create(); } }}/>
      <button type="button" disabled={busy || !name.trim()} onClick={() => void create()}
        className="rounded-md border border-input px-3 text-sm disabled:opacity-50">{busy ? "Adding..." : "Add label"}</button>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
