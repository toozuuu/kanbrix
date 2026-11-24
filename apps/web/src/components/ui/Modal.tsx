import React, { useEffect, useId, useRef } from "react";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "issue";
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
}: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!isOpen || !element) return;
    element.showModal();
    return () => element.close();
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    issue: "max-w-screen-xl",
  };

  return (
    <dialog ref={dialog} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className={cn("m-auto max-h-[90dvh] overflow-y-auto w-[calc(100%-2rem)] rounded-[var(--modal-radius)] border border-border/80 bg-card text-foreground shadow-[var(--shadow-2xl)] focus:outline-none backdrop:bg-black/50 backdrop:backdrop-blur-sm motion-dialog", maxWidths[maxWidth])}>
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between pb-4 border-b border-border/70">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close dialog" onClick={onClose}
            className="rounded-full bg-secondary p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 transform hover:scale-105 "
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
