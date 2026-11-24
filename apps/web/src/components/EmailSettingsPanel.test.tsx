import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { EmailSettingsPanel } from "./EmailSettingsPanel";
import { request } from "../lib/api";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "admin@acme.com" } }),
}));
vi.mock("./ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("../lib/api", () => ({
  request: vi.fn(),
}));

it("loads, saves, and sends a test email for the organization email provider", async () => {
  vi.mocked(request)
    .mockResolvedValueOnce({
      enabled: false,
      provider: "resend",
      from_email: "",
      from_name: "Kanbrix",
      reply_to: null,
      api_url: null,
      domain: null,
      has_api_key: false,
      send_invites: true,
      send_notifications: true,
    })
    .mockResolvedValueOnce({
      enabled: true,
      provider: "sendgrid",
      from_email: "noreply@acme.com",
      from_name: "Acme",
      reply_to: null,
      api_url: null,
      domain: null,
      has_api_key: true,
      send_invites: true,
      send_notifications: true,
    })
    .mockResolvedValueOnce({ sent: true, to: "admin@acme.com" });

  render(
    <QueryClientProvider client={new QueryClient()}>
      <EmailSettingsPanel workspaceId="ws-1" />
    </QueryClientProvider>,
  );

  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Organization Email Provider" })).toBeInTheDocument(),
  );

  fireEvent.click(screen.getByLabelText("Enable organization email delivery"));
  fireEvent.change(screen.getByRole("combobox", { name: "Email Provider" }), {
    target: { value: "sendgrid" },
  });
  fireEvent.change(screen.getByLabelText("API Key"), {
    target: { value: "sg-secret" },
  });
  fireEvent.change(screen.getByLabelText("From Name"), {
    target: { value: "Acme" },
  });
  fireEvent.change(screen.getByLabelText("From Email"), {
    target: { value: "noreply@acme.com" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save email settings" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/workspaces/ws-1/email",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"provider":"sendgrid"'),
      }),
    ),
  );

  fireEvent.click(screen.getByRole("button", { name: "Send test email" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Test email sent successfully."),
  );
});
