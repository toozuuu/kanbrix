import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectSpinner } from "./ProjectSpinner";

describe("ProjectSpinner", () => {
  it("renders with default message and status role", () => {
    render(<ProjectSpinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading project…")).toBeInTheDocument();
  });

  it("renders custom message and submessage", () => {
    render(
      <ProjectSpinner
        message="Refreshing project data…"
        subMessage="Fetching latest workflow and board state"
      />
    );
    expect(screen.getByText("Refreshing project data…")).toBeInTheDocument();
    expect(screen.getByText("Fetching latest workflow and board state")).toBeInTheDocument();
  });

  it("renders fullScreen variant correctly", () => {
    const { container } = render(<ProjectSpinner fullScreen message="Loading Kanbrix…" />);
    expect(container.querySelector(".fixed.inset-0")).toBeInTheDocument();
    expect(screen.getByText("Loading Kanbrix…")).toBeInTheDocument();
  });
});
