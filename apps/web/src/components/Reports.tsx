import { SelectBox } from "./ui/SelectBox";
import {useTranslation} from "react-i18next";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Area,AreaChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {api} from "../lib/api";
import {apiHooks} from "../lib/generated-api";
const stages=[["backlog","Backlog","#778399"],["todo","To do","#5393de"],["active","In progress","#ce951f"],["review","In review","#9967cb"],["done","Done","#268d77"]];
export default function Reports({project}:{project:string}){
  const {t}=useTranslation();
  const [sprint,setSprint]=useState("");const [view,setView]=useState("Flow");
  const sprints=useQuery({queryKey:["report-sprints",project],queryFn:()=>api.sprints.list(project)});
  const rows=apiHooks.useQuery("get","/api/v1/projects/{project}/report",{params:{path:{project},query:sprint?{sprint_id:sprint}:{}}});
  const data=(rows.data??[]).map(r=>({...r,remaining:r.backlog+r.todo+r.active+r.review}));
  return <section className="rounded-xl border border-border bg-card p-5 space-y-3"><h2 className="font-semibold">{t("Project reports")}</h2>
    <div className="flex flex-wrap gap-2"><SelectBox aria-label="Chart" value={view} onChange={e=>setView(e.target.value)}>{["Flow","Burndown","Lead and cycle time"].map(v=><option value={v} key={v}>{t(v)}</option>)}</SelectBox>
    <SelectBox aria-label="Report sprint" value={sprint} onChange={e=>setSprint(e.target.value)}><option value="">{t("All project issues")}</option>{sprints.data?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</SelectBox></div>
    <p className="text-xs text-muted-foreground">{view==="Flow"?"Issues in each workflow category at the end of each UTC day.":view==="Burndown"?"Remaining open issues. Select a sprint to track its changing scope.":"Daily averages for first completions. Lead time starts at creation. Cycle time starts at first entry into In Progress."} History starts when tracking was enabled and shows up to 90 days.</p>
    {rows.isError?<button onClick={()=>rows.refetch()}>Retry report</button>:rows.isPending?<p>{t("Loading report\u2026")}</p>:!data.length?<p>{t("No recorded history yet.")}</p>:
    <ResponsiveContainer width="100%" height={260}>{view==="Flow"?<AreaChart data={data}><XAxis dataKey="day"/><YAxis/><Tooltip/><Legend/>{stages.map(([key,name,color])=><Area key={key} dataKey={key} name={name} stackId="all" stroke={color} fill={color}/>)}</AreaChart>:
    <LineChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="day"/><YAxis/><Tooltip/><Legend/>{view==="Burndown"?<Line dataKey="remaining" name="Open issues" stroke="#5393de"/>:<><Line dataKey="lead_days" name="Lead time (days)" stroke="#5393de"/><Line dataKey="cycle_days" name="Cycle time (days)" stroke="#9967cb"/></>}</LineChart>}</ResponsiveContainer>}</section>;
}
