import { lazy, Suspense, useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import {
  Bold, Code2, Highlighter, Italic, Link2, List, ListOrdered,
  Quote, Redo2, Table2, Underline, Undo2,
  type LucideIcon,
} from "lucide-react";
import { sanitizeRichText } from "../lib/richText";
import { cn } from "../lib/utils";
import { LinkDialog } from "./ui/ActionDialogs";
import { ProjectSpinner } from "./ui/ProjectSpinner";
import { SelectBox } from "./ui/SelectBox";

const HtmlSourceEditor = lazy(() => import("./HtmlSourceEditor"));
const lowlight = createLowlight(common);

export default function RichText({ initialContent, onChange, label, placeholder }: {
  initialContent: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [htmlSource, setHtmlSource] = useState<string | null>(null);
  const [startingContent] = useState(() => sanitizeRichText(initialContent));
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false, defaultProtocol: "https" } }),
      TableKit.configure({ table: { renderWrapper: true } }),
      Highlight,
      Image,
      Placeholder.configure({ placeholder }),
      CharacterCount,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: startingContent,
    editorProps: {
      transformPastedHTML: sanitizeRichText,
      attributes: {
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        class: "rich-editor-content prose prose-sm dark:prose-invert min-h-32 max-w-none break-words px-4 py-3",
      },
    },
    onUpdate: ({ editor: updated }) => onChange(updated.isEmpty ? "" : updated.getHTML()),
  });

  useEffect(() => {
    if (!editor || initialContent === editor.getHTML() || (editor.isEmpty && !initialContent)) return;
    editor.commands.setContent(sanitizeRichText(initialContent), { emitUpdate: false });
  }, [editor, initialContent]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => current && ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      highlight: current.isActive("highlight"),
      link: current.isActive("link"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      code: current.isActive("codeBlock"),
      table: current.isActive("table"),
      heading: [1, 2, 3].find(level => current.isActive("heading", { level })) ?? 0,
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
      words: current.storage.characterCount.words(),
    }),
  });

  if (!editor || !state) return <ProjectSpinner size="sm" message="Loading editor…" />;

  const toolbarGroups: Array<Array<{
    label: string;
    icon: LucideIcon;
    disabled?: boolean;
    pressed?: boolean;
    run: () => void;
  }>> = [
    [
      { label: "Undo", icon: Undo2, disabled: !state.canUndo, run: () => editor.chain().focus().undo().run() },
      { label: "Redo", icon: Redo2, disabled: !state.canRedo, run: () => editor.chain().focus().redo().run() },
    ],
    [
      { label: "Bold", icon: Bold, pressed: state.bold, run: () => editor.chain().focus().toggleBold().run() },
      { label: "Italic", icon: Italic, pressed: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
      { label: "Underline", icon: Underline, pressed: state.underline, run: () => editor.chain().focus().toggleUnderline().run() },
      { label: "Highlight", icon: Highlighter, pressed: state.highlight, run: () => editor.chain().focus().toggleHighlight().run() },
      { label: "Insert link", icon: Link2, run: () => setLinkOpen(true) },
    ],
    [
      { label: "Bullet list", icon: List, pressed: state.bulletList, run: () => editor.chain().focus().toggleBulletList().run() },
      { label: "Numbered list", icon: ListOrdered, pressed: state.orderedList, run: () => editor.chain().focus().toggleOrderedList().run() },
      { label: "Quote", icon: Quote, pressed: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
      { label: "Code block", icon: Code2, pressed: state.code, run: () => editor.chain().focus().toggleCodeBlock().run() },
      { label: "Insert table", icon: Table2, disabled: state.table, run: () => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run() },
    ],
  ];
  const buttonClass = "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground disabled:opacity-40";

  return (
    <div className="rich-editor-surface relative min-w-0 rounded-xl border border-input bg-card">
      <div role="group" aria-label="Editor view" className="flex gap-1 rounded-t-[inherit] border-b border-border bg-muted/60 p-1.5">
        <button type="button" className={buttonClass} aria-pressed={htmlSource === null} onClick={() => setHtmlSource(null)}>
          Visual editor
        </button>
        <button type="button" className={buttonClass} aria-pressed={htmlSource !== null}
          onClick={() => setHtmlSource(previous => previous ?? (editor.isEmpty ? "" : editor.getHTML()))}>
          <Code2 size={15} aria-hidden="true" /> HTML source
        </button>
      </div>

      {htmlSource !== null ? (
        <Suspense fallback={<ProjectSpinner size="sm" message="Loading HTML editor…" className="px-3" />}>
          <HtmlSourceEditor initialContent={htmlSource} onChange={value => {
            editor.commands.setContent(sanitizeRichText(value), { emitUpdate: false });
            onChange(editor.isEmpty ? "" : editor.getHTML());
          }} />
        </Suspense>
      ) : (
        <>
          <div role="group" aria-label="Text formatting" className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
            <SelectBox aria-label="Text style" value={state.heading} onChange={event => {
              const level = Number(event.target.value);
              if (level === 1 || level === 2 || level === 3) editor.chain().focus().setHeading({ level }).run();
              else editor.chain().focus().setParagraph().run();
            }}>
              <option value={0}>Paragraph</option>
              <option value={1}>Heading 1</option>
              <option value={2}>Heading 2</option>
              <option value={3}>Heading 3</option>
            </SelectBox>
            {toolbarGroups.map(group => (
              <div key={group[0].label} className="flex items-center gap-0.5 border-s border-border ps-1">
                {group.map(({ label: action, icon: Icon, disabled, pressed, run }) => (
                  <button key={action} type="button" aria-label={action} title={action} aria-pressed={pressed} disabled={disabled}
                    className={cn(buttonClass, "w-9")} onMouseDown={event => event.preventDefault()} onClick={run}>
                    <Icon size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ))}
          </div>
          {state.link && (
            <button type="button" className={cn(buttonClass, "mx-2 mt-1")} onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}>Remove link</button>
          )}
          {state.table && (
            <div role="group" aria-label="Table editing" className="flex flex-wrap gap-1 border-b border-border px-2 py-1">
              <button type="button" className={buttonClass} onClick={() => editor.chain().focus().addRowAfter().run()}>Add row</button>
              <button type="button" className={buttonClass} onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column</button>
              <button type="button" className={buttonClass} onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</button>
              <button type="button" className={buttonClass} onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</button>
              <button type="button" className={buttonClass} onClick={() => editor.chain().focus().deleteTable().run()}>Remove table</button>
            </div>
          )}
          <EditorContent editor={editor} />
        </>
      )}
      <div className="flex flex-wrap justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {htmlSource !== null && <span>Unsupported markup is removed from the saved draft.</span>}
        <span className="ms-auto tabular-nums">{state.words} {state.words === 1 ? "word" : "words"}</span>
      </div>
      {linkOpen && (
        <LinkDialog onClose={() => setLinkOpen(false)} onInsert={url => {
          if (!editor.can().setLink({ href: url })) return false;
          const chain = editor.chain().focus();
          if (editor.state.selection.empty && !editor.isActive("link")) {
            const { from } = editor.state.selection;
            chain.insertContent({ type: "text", text: url })
              .setTextSelection({ from, to: from + url.length })
              .setLink({ href: url })
              .setTextSelection(from + url.length)
              .unsetMark("link")
              .run();
          } else {
            chain.extendMarkRange("link").setLink({ href: url }).run();
          }
        }} />
      )}
    </div>
  );
}
