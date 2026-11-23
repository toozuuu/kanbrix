import {useEffect} from "react";
import {EditorContent,useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {TableKit} from "@tiptap/extension-table";
import DOMPurify from "dompurify";
export default function RichText({initialContent,onChange,placeholder}:{initialContent:string;onChange:(v:string)=>void;placeholder:string}){
 const editor=useEditor({extensions:[StarterKit,TableKit],content:DOMPurify.sanitize(initialContent),editorProps:{attributes:{role:"textbox","aria-label":placeholder,class:"min-h-20 rounded border border-input p-2"}},
   onUpdate:({editor:e})=>onChange(e.isEmpty?"":e.getHTML())});
 useEffect(()=>{if(editor && initialContent!==editor.getHTML() && !(editor.isEmpty && !initialContent))editor.commands.setContent(DOMPurify.sanitize(initialContent),{emitUpdate:false});},[editor,initialContent]);
 if(!editor)return null;
 return <><div className="flex gap-3 text-sm">{[
   ["Bold",()=>editor.chain().focus().toggleBold().run()],["List",()=>editor.chain().focus().toggleBulletList().run()],
   ["Heading",()=>editor.chain().focus().toggleHeading({level:2}).run()],["Code block",()=>editor.chain().focus().toggleCodeBlock().run()],
   ["Table",()=>editor.chain().focus().insertTable({rows:2,cols:2}).run()]
 ].map(([label,command])=><button key={String(label)} type="button" onClick={()=>typeof command==="function" && command()}>{String(label)}</button>)}</div><EditorContent editor={editor}/></>;
}
