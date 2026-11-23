// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useLiveBoard } from "./useLiveBoard";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("coalesces board changes, reconnects, and stops listening after leaving", () => {
  vi.useFakeTimers();
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    onmessage?: () => void;
    onclose?: () => void;
    close = vi.fn(() => this.onclose?.());
    constructor(readonly url: URL) { sockets.push(this); }
  }
  vi.stubGlobal("WebSocket", FakeSocket);
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const { unmount } = renderHook(() => useLiveBoard("alpha", "viewer"), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  expect(sockets[0].url.pathname).toBe("/api/v1/projects/alpha/live");
  sockets[0].onmessage?.();
  sockets[0].onmessage?.();
  vi.advanceTimersByTime(80);
  expect(invalidate).toHaveBeenCalledTimes(2);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["board-issues", "viewer", "alpha"] });
  sockets[0].close();
  vi.advanceTimersByTime(500);
  expect(sockets).toHaveLength(2);
  sockets[1].onmessage?.();
  unmount();
  vi.advanceTimersByTime(2000);
  expect(sockets[1].close).toHaveBeenCalledOnce();
  expect(sockets).toHaveLength(2);
  expect(invalidate).toHaveBeenCalledTimes(2);
});
