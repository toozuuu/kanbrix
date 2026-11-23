import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { ConfirmAction, LinkDialog } from "./ActionDialogs";
import { DateField } from "./DateField";

vi.mock("../../context/useConfiguration", () => ({
  useConfiguration: () => ({ data: { configuration: { date_format: "dd/MM/yyyy", week_start: 1 } } }),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

it.each(["Delete issue", "Rotate token", "Revoke token"])("%s requires an explicit decision", action => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<ConfirmAction title={action} description="This change takes effect immediately."
    action={action} onConfirm={onConfirm} onCancel={onCancel} />);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: action }));
  expect(onConfirm).toHaveBeenCalledOnce();
});

it.each(["keyboard", "button"])("inserts a link using the %s", method => {
  const onInsert = vi.fn();
  const onClose = vi.fn();
  render(<LinkDialog onInsert={onInsert} onClose={onClose} />);
  const submit = screen.getByRole("button", { name: "Insert link" });
  expect(submit).toBeDisabled();
  const input = screen.getByLabelText("Link URL");
  const url = "https://docs.example.test/issues/KB-24";
  fireEvent.change(input, { target: { value: url } });
  if (method === "keyboard") fireEvent.keyDown(input, { key: "Enter" });
  else fireEvent.click(submit);
  expect(onInsert).toHaveBeenCalledWith(url);
  expect(onClose).toHaveBeenCalledOnce();
});

it("dismisses a drafted link without inserting it", () => {
  const onInsert = vi.fn();
  const onClose = vi.fn();
  render(<LinkDialog onClose={onClose} onInsert={onInsert} />);
  fireEvent.change(screen.getByLabelText("Link URL"), { target: { value: "https://example.test" } });
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onInsert).not.toHaveBeenCalled();
});

it("displays the workspace date format and clears an optional due date", () => {
  const onChange = vi.fn();
  render(<DateField label="Due date" value="2028-02-29" onChange={onChange} />);
  expect(screen.getByLabelText("Due date")).toHaveValue("29/02/2028");
  fireEvent.click(screen.getByRole("button", { name: "Clear Due date" }));
  expect(onChange).toHaveBeenLastCalledWith("");
});

it("limits sprint dates and emits the selected day in API format", () => {
  const onChange = vi.fn();
  render(<DateField label="Sprint end" value="2028-02-21" min="2028-02-20" max="2028-02-29" onChange={onChange} />);
  fireEvent.focus(screen.getByLabelText("Sprint end"));
  expect(screen.getByLabelText("February 19, 2028")).toHaveClass("flatpickr-disabled");
  fireEvent.click(screen.getByLabelText("February 29, 2028"));
  expect(onChange).toHaveBeenLastCalledWith("2028-02-29");
});
