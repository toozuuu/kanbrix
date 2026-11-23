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
      className={cn("m-auto max-h-[90dvh] overflow-y-auto w-[calc(100%-2rem)] rounded-2xl border border-border bg-card text-foreground shadow-2xl focus:outline-none backdrop:bg-black/45 backdrop:backdrop-blur-sm animate-fade-in", maxWidths[maxWidth])}>
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between pb-4 border-b border-border">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground animate-slide-in from-[opacity:0] from-[translateY:4px] to-[opacity:100] to-[translateY:0] animation-[slideUp_0.15s_ease-out_0.1s_both]">{title}</h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5 animate-fade-in from-[opacity:0] from-[translateY:2px] to-[opacity:100] to-[translateY:0] animation-[fadeIn_0.15s_ease-out_0.15s_both]">{description}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close dialog" onClick={onClose}
            className="rounded-full bg-secondary p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 transform hover:scale-105 focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 animate-fade-in from-[opacity:0] from-[translateY:2px] to-[opacity:100] to-[translateY:0] animation-[fadeIn_0.15s_ease-out_0.25s_both]">{children}</div>
      </div>
    </dialog>
  );
}
