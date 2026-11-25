import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmAction({ title, description, action, onCancel, onConfirm }: {
  title: string; description: string; action: string; onCancel: () => void; onConfirm: () => void;
}) {
  return <Modal isOpen title={title} description={description} onClose={onCancel} maxWidth="sm">
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button type="button" variant="destructive" onClick={onConfirm}>{action}</Button>
    </div>
  </Modal>;
}

export function LinkDialog({ onClose, onInsert }: { onClose: () => void; onInsert: (url: string) => void | false }) {
  const [url, setUrl] = useState("");
  const [invalid, setInvalid] = useState(false);
  function insert() {
    if (!url.trim()) return;
    if (onInsert(url.trim()) === false) setInvalid(true);
    else onClose();
  }
  return <Modal isOpen title="Insert link" onClose={onClose} maxWidth="sm">
    <label className="block text-sm">Link URL
      <input autoFocus type="url" className="mt-1 w-full rounded-md border border-input bg-card px-3"
        aria-invalid={invalid || undefined} value={url} onChange={e => {
          setUrl(e.target.value);
          setInvalid(false);
        }} onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); insert(); }
        }} />
    </label>
    {invalid && <p role="alert" className="mt-1 text-sm text-destructive">Enter a supported link URL.</p>}
    <div className="mt-4 flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      <Button type="button" disabled={!url.trim()} onClick={insert}>Insert link</Button>
    </div>
  </Modal>;
}
