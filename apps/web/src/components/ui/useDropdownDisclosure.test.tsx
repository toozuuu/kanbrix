// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useDropdownDisclosure } from "./useDropdownDisclosure";

afterEach(cleanup);

it("keeps the panel open between its controls and restores trigger focus on Escape", () => {
  function Example() {
    const [open, setOpen] = useState(false);
    const menu = useDropdownDisclosure(open, setOpen);
    return <div {...menu.container}>
      <button {...menu.trigger} onClick={() => setOpen(!open)}>Workspaces</button>
      {open && <div {...menu.panel}><button>Engineering</button></div>}
    </div>;
  }
  render(<Example />);
  const trigger = screen.getByRole("button", { name: "Workspaces" });
  trigger.focus();
  fireEvent.click(trigger);
  const choice = screen.getByRole("button", { name: "Engineering" });
  choice.focus();
  expect(document.getElementById(trigger.getAttribute("aria-controls")!)?.contains(choice)).toBe(true);
  fireEvent.keyDown(choice, { key: "Escape" });
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});
