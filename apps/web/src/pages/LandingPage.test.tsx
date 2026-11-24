import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

it("keeps the hero workflow and board in sync when either moves the issue", () => {
  render(<MemoryRouter><LandingPage/></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Write release notes: start work" }));
  const board = within(screen.getByRole("region", { name: "Interactive sample board" }));
  fireEvent.click(board.getByRole("button", { name: "Write release notes: advance to Done" }));
  expect(screen.getByRole("button", { name: "Write release notes: reopen issue" })).toBeInTheDocument();
  expect(board.getByRole("progressbar")).toHaveAttribute("value", "2");
});
