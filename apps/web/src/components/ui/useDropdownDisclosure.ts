import { useId, useRef, type FocusEvent, type KeyboardEvent } from "react";

export function useDropdownDisclosure(open: boolean, setOpen: (open: boolean) => void) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (open && event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
  }
  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }
  return {
    container: { onKeyDown, onBlur },
    trigger: { ref: trigger, "aria-expanded": open, "aria-controls": open ? id : undefined },
    panel: { id },
  };
}
