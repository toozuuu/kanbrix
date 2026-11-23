// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Attachments } from "./Attachments";
import { request } from "../../lib/api";
import { apiHooks } from "../../lib/generated-api";

vi.mock("../../lib/api", () => ({ request: vi.fn() }));
vi.mock("../ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Attachments component", () => {
  const queryClient = new QueryClient();

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.spyOn(apiHooks, "useQuery").mockReturnValue({
      data: [],
      isError: false,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);
  });

  it("renders upload area with correct instructions", () => {
    render(<Attachments issue="test-issue-id" />, { wrapper });

    expect(screen.getByText(/drop files here or click to browse/i)).toBeTruthy();
    expect(screen.getByText(/10 MiB each/i)).toBeTruthy();
  });

  it("shows no attachments message when empty", () => {
    render(<Attachments issue="test-issue-id" />, { wrapper });

    expect(screen.getByText(/no attachments yet/i)).toBeTruthy();
  });

  it("displays attachments list when files exist", async () => {
    const mockAttachments = [
      { id: "1", filename: "document.pdf", size: 1024 },
      { id: "2", filename: "image.png", size: 2048 },
    ];

    vi.spyOn(apiHooks, "useQuery").mockReturnValue({
      data: mockAttachments,
      isError: false,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    render(<Attachments issue="test-issue-id" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("document.pdf")).toBeTruthy();
      expect(screen.getByText("image.png")).toBeTruthy();
    });
  });

  it("formats file sizes correctly", async () => {
    const mockAttachments = [
      { id: "1", filename: "small.txt", size: 500 },
      { id: "2", filename: "larger.pdf", size: 2048 },
      { id: "3", filename: "large.zip", size: 2 * 1024 * 1024 },
    ];

    vi.spyOn(apiHooks, "useQuery").mockReturnValue({
      data: mockAttachments,
      isError: false,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    render(<Attachments issue="test-issue-id" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/500 B/)).toBeTruthy();
      expect(screen.getByText(/2\.0 KiB/)).toBeTruthy();
      expect(screen.getByText(/2.0 MiB/)).toBeTruthy();
    });
  });

  it("shows retry button on error", () => {
    vi.spyOn(apiHooks, "useQuery").mockReturnValue({
      data: null,
      isError: true,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    render(<Attachments issue="test-issue-id" />, { wrapper });

    expect(screen.getByText(/retry/i)).toBeTruthy();
  });

  it("handles file selection via input", async () => {
    const mockFiles = [
      new File(["test content"], "test.txt", { type: "text/plain" }),
    ];

    vi.spyOn(apiHooks, "useQuery").mockReturnValue({
      data: [],
      isError: false,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    render(<Attachments issue="test-issue-id" />, { wrapper });

    const fileInput = screen.getByLabelText(/drop files here/i);
    fireEvent.change(fileInput, { target: { files: mockFiles } });
    await waitFor(() => expect(request).toHaveBeenCalledWith(
      "/issues/test-issue-id/attachments", {method: "POST", body: expect.any(FormData)}
    ));
  });
});