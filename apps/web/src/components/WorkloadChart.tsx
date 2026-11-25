import { Cell, Pie, PieChart, Tooltip } from "recharts";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Issue } from "../types";
import { SelectBox } from "./ui/SelectBox";

type Member = { id: string | null; name: string; count: number; points: number; unestimated: number };

function memberColor(id: string | null) {
  if (!id) return "#8492a6";
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 47% 56%)`;
}

export default function WorkloadChart({ rows, project, onSelectIssue }: {
  rows?: Member[]; project: string; onSelectIssue: (issue: Issue) => void;
}) {
  const [sprint, setSprint] = useState("");
  const [metric, setMetric] = useState<"count" | "points">("count");
  const [member, setMember] = useState<string | null | undefined>();
  const [offset, setOffset] = useState(0);
  const sprints = useQuery({queryKey:["report-sprints",project], queryFn:() => api.sprints.list(project)});
  const filtered = useQuery({queryKey:["dashboard-issues","workload",project,sprint],
    queryFn:() => api.issues.counts(project,sprint), enabled:!!sprint});
  const details = useQuery({queryKey:["dashboard-issues","workload-detail",project,sprint,member,offset],
    enabled:member !== undefined, queryFn:() => api.issues.list(project,{
      sprint_id:sprint || undefined, assignee_id:member ?? undefined, unassigned:member === null,
      open_only:true, limit:21, offset,
    })});
  const data = sprint ? filtered.data?.workload : rows;
  const total = data?.reduce((sum,row) => sum + row[metric], 0) ?? 0;
  const unestimated = data?.reduce((sum,row) => sum + row.unestimated, 0) ?? 0;
  function select(id: string | null) {setMember(id); setOffset(0);}
  return <section aria-label="Member workload" className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
    <h2 className="text-base font-semibold tracking-tight">Member workload</h2>
    <div className="flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
      <label className="grid min-w-0 gap-1">Sprint <SelectBox value={sprint} onChange={e => {setSprint(e.target.value); setMember(undefined); setOffset(0);}}>
        <option value="">All sprints and backlog</option>
        {sprints.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </SelectBox></label>
      <label className="grid min-w-0 gap-1">Measure <SelectBox value={metric} onChange={e => setMetric(e.target.value === "points" ? "points" : "count")}>
        <option value="count">Open issues</option><option value="points">Estimated story points</option>
      </SelectBox></label>
    </div>
    {sprints.isError && <p>Could not load sprints. <button onClick={() => void sprints.refetch()}>Retry</button></p>}
    {metric === "points" && data && <p className="text-sm">{unestimated} open {unestimated === 1 ? "issue" : "issues"} without an estimate</p>}
    {sprint && filtered.isLoading ? <p>Loading workload…</p> : !data ? <p>Workload data is unavailable.</p> :
      !data.length ? <p>No open issues in this selection.</p> :
      <div className="flex flex-wrap items-center justify-center gap-3">
        {total > 0 && <PieChart width={164} height={164}>
          <Pie data={data} dataKey={metric} nameKey="name" innerRadius={49} outerRadius={77} isAnimationActive={false} stroke="hsl(var(--card))"
            onClick={(_,index) => select(data[index].id)}>
            {data.map(row => <Cell key={row.id ?? "unassigned"} fill={memberColor(row.id)} />)}
          </Pie><Tooltip />
        </PieChart>}
        <ul className="min-w-0 flex-1 basis-40 divide-y divide-border/75">{data.map(row =>
          <li key={row.id ?? "unassigned"}><button onClick={() => select(row.id)} aria-pressed={member === row.id}
            className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-accent aria-pressed:bg-accent">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:memberColor(row.id)}} />
            <span className="min-w-0 flex-1 break-words">{row.name}</span><span className="shrink-0 tabular-nums">{row[metric]} ({total ? Math.round(row[metric]*100/total) : 0}%)</span>
          </button></li>)}</ul>
      </div>}
    {member !== undefined && <div className="border-t border-border pt-3">
      <h3 className="font-semibold">Open issues · {data?.find(row => row.id === member)?.name ?? "Selected assignee"}</h3>
      {details.isError ? <button onClick={() => void details.refetch()}>Retry loading issues</button> :
        !details.data ? <p>Loading issues…</p> : !details.data.length ? <p>No issues on this page.</p> :
        <ul>{details.data.slice(0,20).map(issue => <li key={issue.id}><button className="py-1 text-left underline" onClick={() => onSelectIssue(issue)}>{issue.identifier} {issue.title}</button></li>)}</ul>}
      {offset > 0 && <button className="mr-3" onClick={() => setOffset(offset-20)}>Previous</button>}
      {(details.data?.length ?? 0)>20 && <button onClick={() => setOffset(offset+20)}>Next</button>}
    </div>}
  </section>;
}
