import MarkdownInput from "./ui/MarkdownEditor";
import {lazy,Suspense,useState} from "react";
import ReactMarkdown from "react-markdown";
import {useTranslation} from "react-i18next";
import {MarkdownRenderer} from "./ui/MarkdownRenderer";
const RichEditor=lazy(()=>import("./RichText"));
const isRich=(value:string)=>/^<(p|h[1-6]|ul|ol|blockquote|pre|table)(\s|>)/i.test(value.trimStart());
export function Markdown({text,className=""}:{text:string;className?:string}){
  return <div className={className+" space-y-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_pre]:overflow-auto [&_pre]:bg-secondary [&_pre]:p-2 [&_a]:underline"}>
    {isRich(text)?<MarkdownRenderer content={text}/>:<ReactMarkdown skipHtml>{text}</ReactMarkdown>}
  </div>;
}
export function MarkdownEditor({label="Content",value,onChange,placeholder,className=""}:{label?:string;value:string;onChange:(v:string)=>void;placeholder?:string;className?:string}){
  const [preview,setPreview]=useState(false);
  const [rich,setRich]=useState(()=>isRich(value));const {t}=useTranslation();
  return <fieldset className={"min-w-0 flex-1 space-y-2 "+className}><legend>{label}</legend>
    <div className="flex gap-3 text-xs"><button type="button" onClick={()=>setPreview(!preview)}>{t(preview?"Write":"Preview")}</button>
    {!value && <button type="button" onClick={()=>setRich(!rich)}>{rich?"Markdown":"Rich text"}</button>}</div>
    {preview?<Markdown text={value}/>:rich?<Suspense fallback={<p>Loading editor…</p>}><RichEditor initialContent={value} onChange={onChange} placeholder={label}/></Suspense>:
      <MarkdownInput initialContent={value} onChange={onChange} placeholder={placeholder??label}/>}
  </fieldset>;
}
export default MarkdownEditor;
