import { Upload, Paperclip } from "lucide-react";
import {useTranslation} from "react-i18next";
import {useRef,useState} from "react";
import {apiHooks} from "../../lib/generated-api";
import {request} from "../../lib/api";
import {useToast} from "../ui/Toast";
import type {components} from "../../lib/api-schema";
type Attachment = components["schemas"]["Attachment"];

export function Attachments({issue}:{issue:string}){
  const {t}=useTranslation();
  const base=`/issues/${issue}/attachments`;
  const query=apiHooks.useQuery("get","/api/v1/issues/{issue}/attachments",{params:{path:{issue}}});
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const {toast}=useToast();

  async function upload(files:File[]){
    if(lock.current)return;
    lock.current=true;
    setBusy(true);
    try{
      for(const file of files){
        if(!file.size || file.size>10*1024*1024)throw Error("Select nonempty files up to 10 MiB each");
        const body=new FormData();
        body.append("file",file);
        await request(base,{method:"POST",body});
      }
    }
    catch(e){
      toast(e instanceof Error?e.message:"Upload failed","error");
    }
    finally{
      await query.refetch();
      lock.current=false;
      setBusy(false);
    }
  }

  const formatSize = (size: number) => {
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MiB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KiB`;
    return `${size} B`;
  };

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("Attachments")}</h3>

      <label className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border/80 bg-secondary/20 p-5 text-center text-sm cursor-pointer hover:border-primary/50 hover:bg-primary/[0.04] transition-all"
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? "none" : "copy"; }}
        onDrop={event => {
          event.preventDefault();
          if (!busy) void upload(Array.from(event.dataTransfer.files));
        }}>
        <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium text-foreground">
          {busy ? "Uploading…" : "Drop files here or click to browse"}
        </span>
        <span className="text-xs text-muted-foreground">10 MiB each</span>
        <input
          disabled={busy}
          type="file"
          multiple
          className="sr-only"
          onChange={e=>{
            void upload(Array.from(e.target.files??[]));
            e.target.value="";
          }}
        />
      </label>

      {query.isError && (
        <button
          type="button"
          onClick={()=>query.refetch()}
          className="text-xs text-primary hover:underline"
        >
          {t("Retry")}
        </button>
      )}

      {query.data && query.data.length > 0 && (
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {query.data.map((f: Attachment)=>(
            <a
              key={f.id}
              href={`/api/v1${base}/${f.id}`}
              download={f.filename}
              className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm shadow-sm hover:border-primary/40 hover:bg-accent/30 transition-colors text-primary"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium">{f.filename}</span>
              <span className="shrink-0 text-xs text-muted-foreground">({formatSize(f.size)})</span>
            </a>
          ))}
        </div>
      )}

      {query.data && query.data.length === 0 && !busy && (
        <p className="text-xs text-muted-foreground/60 italic">
          No attachments yet
        </p>
      )}
    </section>
  );
}
