import { useTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { Command, FileText, Layout, Folder, Users, BarChart3 } from "lucide-react";

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  const { t } = useTranslation();

  const shortcuts = [
    { keys: ".", action: t("keyboard_shortcuts.open_command_palette"), icon: Command },
    { keys: "/", action: t("keyboard_shortcuts.open_command_palette"), icon: Command },
    { keys: "c", action: t("keyboard_shortcuts.create_new_issue"), icon: FileText },
    { keys: "l", action: t("keyboard_shortcuts.assign_to_self"), icon: FileText },
    { keys: "g k", action: t("keyboard_shortcuts.go_to_kanban"), icon: Layout },
    { keys: "g b", action: t("keyboard_shortcuts.go_to_backlog"), icon: BarChart3 },
    { keys: "g p", action: t("keyboard_shortcuts.go_to_projects"), icon: Folder },
    { keys: "g d", action: t("keyboard_shortcuts.go_to_dashboard"), icon: BarChart3 },
    { keys: "g m", action: t("keyboard_shortcuts.go_to_members"), icon: Users },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("keyboard_shortcuts.title")} maxWidth="lg">
      <div className="grid gap-1.5 py-2">
        {shortcuts.map((shortcut, idx) => {
          const Icon = shortcut.icon;
          return (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent/60 transition-colors"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm">{shortcut.action}</span>
              <div className="flex shrink-0 gap-1">
                {shortcut.keys.split(" ").map((key, kIdx) => (
                  <kbd
                    key={kIdx}
                    className="min-w-[1.5rem] text-center px-2 py-0.5 text-xs font-mono font-semibold bg-muted border border-border/60 rounded-md shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}