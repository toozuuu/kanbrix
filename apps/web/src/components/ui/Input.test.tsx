import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Input } from "./Input";

it("reveals and hides a password without changing the value or submitting the form", () => {
  const submit = vi.fn(event => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <Input type="password" label="Password" defaultValue="demo-password" />
    </form>,
  );

  const password = screen.getByLabelText("Password");
  expect(password).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");
  expect(password).toHaveValue("demo-password");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(password).toHaveAttribute("type", "password");
  expect(password).toHaveValue("demo-password");
  expect(submit).not.toHaveBeenCalled();
});
