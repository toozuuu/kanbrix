import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

it("keeps the hero workflow and board in sync when either moves the issue", () => {
  render(<MemoryRouter><LandingPage/></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Write release notes: start work" }));
  const board = within(screen.getByRole("region", { name: "Interactive sample board" }));
  const advance = board.getByRole("button", { name: "Write release notes: advance to Done" });
  advance.focus();
  fireEvent.click(advance);
  expect(screen.getByRole("button", { name: "Write release notes: reopen issue" })).toBeInTheDocument();
  expect(board.getByRole("button", { name: "Write release notes: reopen" })).toHaveFocus();
  expect(board.getByRole("progressbar")).toHaveAttribute("value", "2");

  const stages = within(screen.getByRole("group", { name: "Release workflow stages" }));
  fireEvent.click(stages.getByRole("button", { name: "To do" }));
  expect(stages.getByRole("button", { name: "To do" })).toHaveAttribute("aria-pressed", "true");
  expect(board.getByRole("button", { name: "Write release notes: advance to In progress" })).toBeInTheDocument();
});
