import { useEffect } from "react";

interface DocumentMetaOptions {
  title: string;
  description?: string;
}

function setMeta(selector: string, content: string) {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) el.content = content;
}

export function useDocumentMeta({ title, description }: DocumentMetaOptions) {
  useEffect(() => {
    document.title = title;
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[name="twitter:title"]', title);
    if (description) {
      setMeta('meta[name="description"]', description);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[name="twitter:description"]', description);
    }
  }, [title, description]);
}
