import {useEffect} from "react";
import {EditorContent,useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {TableKit} from "@tiptap/extension-table";
import DOMPurify from "dompurify";
export default function RichText({initialContent,onChange,placeholder}:{initialContent:string;onChange:(v:string)=>void;placeholder:string}){
 const editor=useEditor({extensions:[StarterKit,TableKit],content:DOMPurify.sanitize(initialContent),editorProps:{attributes:{role:"textbox","aria-label":placeholder,class:"min-h-28 break-words px-3 py-2 text-sm  [&_ol]:list-decimal [&_ul]:list-disc [&_li]:ml-5 [&_h2]:text-lg [&_h2]:font-semibold [&_pre]:overflow-auto [&_pre]:bg-secondary [&_pre]:p-2 [&_table]:w-full [&_td]:border [&_th]:border"}},
   onUpdate:({editor:e})=>onChange(e.isEmpty?"":e.getHTML())});
 useEffect(()=>{if(editor && initialContent!==editor.getHTML() && !(editor.isEmpty && !initialContent))editor.commands.setContent(DOMPurify.sanitize(initialContent),{emitUpdate:false});},[editor,initialContent]);
 if(!editor)return null;
 const actions = [
   { label: "Bold", run: () => editor.chain().focus().toggleBold().run() },
   { label: "Italic", run: () => editor.chain().focus().toggleItalic().run() },
   { label: "Bullet list", run: () => editor.chain().focus().toggleBulletList().run() },
   { label: "Numbered list", run: () => editor.chain().focus().toggleOrderedList().run() },
   { label: "Heading", run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
   { label: "Code block", run: () => editor.chain().focus().toggleCodeBlock().run() },
   { label: "Table", run: () => editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run() },
 ];
 return (
   <div className="rounded-lg border border-input bg-background focus-within:border-ring">
     <div role="group" aria-label="Text formatting" className="flex flex-wrap gap-1 border-b border-border bg-secondary/40 p-1.5">
       {actions.map(({ label, run }) => (
         <button key={label} type="button" onClick={run} className="rounded px-2 py-1 text-xs font-medium hover:bg-accent">
           {label}
         </button>
       ))}
     </div>
     <EditorContent editor={editor}/>
   </div>
 );
}
