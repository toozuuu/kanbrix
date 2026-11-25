import { ProjectSpinner } from "./ui/ProjectSpinner";
import { SelectBox } from "./ui/SelectBox";
import {useTranslation} from "react-i18next";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Area,AreaChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {api} from "../lib/api";
import {apiHooks} from "../lib/generated-api";
const stages=[["backlog","Backlog","var(--chart-backlog)"],["todo","To do","var(--chart-todo)"],["active","In progress","var(--chart-active)"],["review","In review","var(--chart-secondary)"],["done","Done","var(--chart-main)"]] as const;
export default function Reports({project}:{project:string}){
  const {t}=useTranslation();
  const [sprint,setSprint]=useState("");const [view,setView]=useState("Flow");
  const sprints=useQuery({queryKey:["report-sprints",project],queryFn:()=>api.sprints.list(project)});
  const rows=apiHooks.useQuery("get","/api/v1/projects/{project}/report",{params:{path:{project},query:sprint?{sprint_id:sprint}:{}}});
  const data=(rows.data??[]).map(r=>({...r,remaining:r.backlog+r.todo+r.active+r.review}));
  const series: {key: keyof (typeof data)[number]; name: string}[] = view === "Flow"
    ? stages.map(([key,name]) => ({key,name}))
    : view === "Burndown" ? [{key:"remaining", name:"Open issues"}]
    : [{key:"lead_days", name:"Lead time (days)"}, {key:"cycle_days", name:"Cycle time (days)"}];
  const tick = {fill:"hsl(var(--muted-foreground))", fontSize:12};
  const axes = <>
    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4"/>
    <XAxis dataKey="day" tick={tick} tickLine={false} minTickGap={28} tickFormatter={day => String(day).slice(5)}/>
    <YAxis tick={tick} width={40} axisLine={false} tickLine={false} allowDecimals={view === "Lead and cycle time"}/>
    <Tooltip contentStyle={{backgroundColor:"hsl(var(--popover))",color:"hsl(var(--popover-foreground))",borderColor:"hsl(var(--border))",borderRadius:"0.75rem",boxShadow:"var(--shadow-md)"}}
      itemStyle={{color:"hsl(var(--foreground))"}}/>
    <Legend wrapperStyle={{fontSize:12}}/>
  </>;
  return <section className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight text-foreground">{t("Project reports")}</h2>
      <div className="flex flex-wrap gap-2"><SelectBox aria-label="Chart" value={view} onChange={e=>setView(e.target.value)}>{["Flow","Burndown","Lead and cycle time"].map(v=><option value={v} key={v}>{t(v)}</option>)}</SelectBox>
      <SelectBox aria-label="Report sprint" value={sprint} onChange={e=>setSprint(e.target.value)}><option value="">{t("All project issues")}</option>{sprints.data?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</SelectBox></div>
    </div>
    {sprints.isError && <p role="alert" className="text-sm">Could not load sprint choices. <button className="underline" onClick={() => void sprints.refetch()}>Retry sprints</button></p>}
    <p className="text-xs text-muted-foreground">{view==="Flow"?"Issues in each workflow category at the end of each UTC day.":view==="Burndown"?"Remaining open issues. Select a sprint to track its changing scope.":"Daily averages for first completions. Lead time starts at creation. Cycle time starts at first entry into In Progress."} History starts when tracking was enabled and shows up to 90 days.</p>
    {rows.isError?<button onClick={()=>rows.refetch()}>Retry report</button>:rows.isPending?<ProjectSpinner size="sm" message={t("Loading report.")}/>:!data.length?<p>{t("No recorded history yet.")}</p>:
    <div className="min-w-0 space-y-3">
      <ResponsiveContainer key={view} className="motion-report" width="100%" height={280}>
        {view==="Flow" ? (
          <AreaChart data={data} accessibilityLayer margin={{left: 0, right: 12}}>
            {axes}
            {stages.map(([key,name,color]) => (
              <Area key={key} dataKey={key} name={name} stackId="all" stroke={color}
                fill={color} fillOpacity={0.72} isAnimationActive={false}/>
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data} accessibilityLayer margin={{left: 0, right: 12}}>
            {axes}
            {series.map(({key,name}, index) => (
              <Line key={key} dataKey={key} name={name} stroke={index ? "var(--chart-secondary)" : "var(--chart-main)"}
                strokeWidth={2.5} strokeDasharray={index ? "6 3" : undefined}
                dot={{r: 2}} isAnimationActive={false}/>
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
      <details className="text-sm">
        <summary className="cursor-pointer py-2 font-medium">View chart data</summary>
        <div className="max-h-72 overflow-auto" role="region" aria-label="Daily report values" tabIndex={0}>
          <table className="w-full border-collapse text-right tabular-nums">
            <caption className="sr-only">{view} daily values</caption>
            <thead className="sticky top-0 bg-card"><tr><th scope="col" className="p-2 text-left">Date (UTC)</th>
              {series.map(({key,name}) => <th scope="col" className="p-2" key={key}>{name}</th>)}
            </tr></thead>
            <tbody>{data.map(row => <tr key={row.day} className="border-t border-border">
              <th scope="row" className="whitespace-nowrap p-2 text-left font-normal">{row.day}</th>
              {series.map(({key}) => <td key={key} className="p-2">{row[key] ?? "—"}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>}</section>;
}
