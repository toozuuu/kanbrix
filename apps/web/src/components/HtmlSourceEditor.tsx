import { useEffect, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";

const surface = EditorView.theme({
  "&": { backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" },
  ".cm-scroller": { overflow: "auto", maxHeight: "20rem", fontFamily: "var(--font-code)" },
  ".cm-content": { minHeight: "9rem" },
  ".cm-gutters": {
    backgroundColor: "hsl(var(--muted))",
    color: "hsl(var(--muted-foreground))",
    borderColor: "hsl(var(--border))",
  },
});

export default function HtmlSourceEditor({ initialContent, onChange }: {
  initialContent: string;
  onChange: (value: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const initial = useRef(initialContent);
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const dark = document.documentElement.classList.contains("dark");
    const editor = new EditorView({
      parent: host.current,
      doc: initial.current,
      extensions: [
        basicSetup,
        html(),
        dark ? oneDark : [],
        surface,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": "HTML source", "aria-multiline": "true" }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) callback.current(update.state.doc.toString());
        }),
      ],
    });
    return () => editor.destroy();
  }, []);

  return <div ref={host} />;
}
