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

      <label className="block rounded-lg border border-dashed border-input p-3 text-sm cursor-pointer hover:bg-secondary/20 transition-colors"
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? "none" : "copy"; }}
        onDrop={event => {
          event.preventDefault();
          if (!busy) void upload(Array.from(event.dataTransfer.files));
        }}>
        {busy?"Uploading…":"Drop files here or click to browse (10 MiB each)"}
        <input
          disabled={busy}
          type="file"
          multiple
          className="block mt-2 hidden"
          onChange={e=>{
            void upload(Array.from(e.target.files??[]));
            e.target.value="";
          }}
        />
      </label>

      {query.isError && (
        <button
          onClick={()=>query.refetch()}
          className="text-xs text-primary hover:underline"
        >
          {t("Retry")}
        </button>
      )}

      {query.data && query.data.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {query.data.map((f: Attachment)=>(
            <a
              key={f.id}
              href={`/api/v1${base}/${f.id}`}
              download={f.filename}
              className="block text-sm hover:underline text-primary"
            >
              <span className="font-medium">{f.filename}</span>
              <span className="text-muted-foreground ml-2">({formatSize(f.size)})</span>
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
