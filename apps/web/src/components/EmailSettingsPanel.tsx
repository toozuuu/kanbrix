import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import { request } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ui/Toast";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { SelectBox } from "./ui/SelectBox";
import { ProjectSpinner } from "./ui/ProjectSpinner";

interface EmailSettings {
  enabled: boolean;
  provider: string;
  from_email: string;
  from_name: string;
  reply_to?: string | null;
  api_url?: string | null;
  domain?: string | null;
  has_api_key: boolean;
  send_invites: boolean;
  send_notifications: boolean;
}

export function EmailSettingsPanel({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["workspace-email", user?.id, workspaceId],
    queryFn: () => request<EmailSettings>(`/workspaces/${workspaceId}/email`),
  });

  if (q.isError && !q.data) {
    return (
      <p role="alert" className="text-sm">
        Could not load email settings.{" "}
        <button type="button" className="underline" onClick={() => void q.refetch()}>
          Retry
        </button>
      </p>
    );
  }
  if (!q.data) {
    return <ProjectSpinner size="sm" message="Loading email settings." />;
  }

  return (
    <EmailEditor
      key={`${workspaceId}-${q.data.provider}-${q.data.has_api_key}`}
      workspaceId={workspaceId}
      initial={q.data}
      defaultTestEmail={user?.email ?? ""}
    />
  );
}

function EmailEditor({
  workspaceId,
  initial,
  defaultTestEmail,
}: {
  workspaceId: string;
  initial: EmailSettings;
  defaultTestEmail: string;
}) {
  const client = useQueryClient();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(initial.enabled);
  const [provider, setProvider] = useState(initial.provider);
  const [fromEmail, setFromEmail] = useState(initial.from_email);
  const [fromName, setFromName] = useState(initial.from_name);
  const [replyTo, setReplyTo] = useState(initial.reply_to ?? "");
  const [apiUrl, setApiUrl] = useState(initial.api_url ?? "");
  const [domain, setDomain] = useState(initial.domain ?? "");
  const [apiKey, setApiKey] = useState("");
  const [sendInvites, setSendInvites] = useState(initial.send_invites);
  const [sendNotifications, setSendNotifications] = useState(initial.send_notifications);
  const [testTo, setTestTo] = useState(defaultTestEmail);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSent, setTestSent] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTestSent(false);
    try {
      const saved = await request<EmailSettings>(`/workspaces/${workspaceId}/email`, {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          provider,
          from_email: fromEmail.trim(),
          from_name: fromName.trim() || "Kanbrix",
          reply_to: replyTo.trim() || null,
          api_url: apiUrl.trim() || null,
          domain: domain.trim() || null,
          api_key: apiKey.trim() || null,
          send_invites: sendInvites,
          send_notifications: sendNotifications,
        }),
      });
      client.setQueryData(["workspace-email", undefined, workspaceId], saved);
      await client.invalidateQueries({ queryKey: ["workspace-email"] });
      setApiKey("");
      toast("Email provider settings saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save email settings", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    setTesting(true);
    setTestSent(false);
    try {
      const res = await request<{ sent: boolean; to: string }>(
        `/workspaces/${workspaceId}/email/test`,
        {
          method: "POST",
          body: JSON.stringify({ to: testTo.trim() || undefined }),
        },
      );
      setTestSent(true);
      toast(`Test email sent to ${res.to}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Test email failed", "error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6 space-y-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Organization Email Provider
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure your own email service (Resend, SendGrid, Mailgun, Postmark, or custom HTTP relay) for workspace invitations and notifications.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Enable organization email delivery</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-foreground space-y-1.5">
            <span>Email Provider</span>
            <SelectBox
              fullWidth
              aria-label="Email Provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="resend">Resend</option>
              <option value="sendgrid">SendGrid</option>
              <option value="mailgun">Mailgun</option>
              <option value="postmark">Postmark</option>
              <option value="webhook">Custom HTTP Webhook / Relay</option>
            </SelectBox>
          </label>

          <Input
            label={
              provider === "postmark"
                ? "Postmark Server Token"
                : provider === "webhook"
                  ? "Bearer Token (optional)"
                  : "API Key"
            }
            type="password"
            placeholder={
              initial.has_api_key
                ? "Saved (leave blank to keep current key)"
                : "Paste API key…"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />

          <Input
            label="From Name"
            placeholder="Acme Engineering"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />

          <Input
            label="From Email"
            type="email"
            placeholder="noreply@your-domain.com"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            required={enabled}
          />

          <Input
            label="Reply-To Email (optional)"
            type="email"
            placeholder="support@your-domain.com"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
          />

          {provider === "mailgun" && (
            <Input
              label="Mailgun Sending Domain"
              placeholder="mg.your-domain.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required={enabled}
            />
          )}

          {(provider === "mailgun" || provider === "webhook") && (
            <Input
              label={provider === "mailgun" ? "Mailgun Region URL (optional)" : "Email Webhook URL"}
              placeholder={
                provider === "mailgun"
                  ? "https://api.mailgun.net"
                  : "https://mailer.your-domain.com/send"
              }
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              required={enabled && provider === "webhook"}
            />
          )}
        </div>

        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendInvites}
              onChange={(e) => setSendInvites(e.target.checked)}
            />
            <span>Send workspace member invitation emails</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendNotifications}
              onChange={(e) => setSendNotifications(e.target.checked)}
            />
            <span>Send issue &amp; deadline notification emails</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
          <Button type="submit" size="sm" isLoading={saving}>
            Save email settings
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 space-y-3">
        <p className="text-xs font-semibold text-foreground">Test Email Delivery</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <Input
              label="Recipient Email"
              type="email"
              placeholder="you@company.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            isLoading={testing}
            disabled={!enabled}
            onClick={() => void handleSendTest()}
            className="gap-1.5 h-10"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Send test email</span>
          </Button>
        </div>
        {testSent && (
          <p role="status" className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Test email sent successfully.</span>
          </p>
        )}
      </div>
    </section>
  );
}
