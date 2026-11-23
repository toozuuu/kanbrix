import { ConfirmAction } from "../components/ui/ActionDialogs";
import { SelectBox } from "../components/ui/SelectBox";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { request } from "../lib/api";
import { Button } from "../components/ui/Button";
import { control } from "../components/CustomFields";
import { useToast } from "../components/ui/Toast";
interface Rules {
  events: string[];
  destination: string;
  notify_assignee: boolean;
  credential: boolean;
}
interface Integration {
  settings: Rules;
  destinations: string[];
  history: {
    id: number;
    event: string;
    attempts: number;
    delivered: boolean;
    destination: string;
    created_at: string;
  }[];
}
export function IntegrationSettings() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const ws = currentWorkspace?.id;
  const admin =
    !!currentWorkspace && ["Owner", "Admin"].includes(currentWorkspace.role);
  const q = useQuery({
    queryKey: ["integrations", user?.id, ws],
    queryFn: () => request<Integration>(`/workspaces/${ws}/integrations`),
    enabled: admin,
    refetchInterval: 30000,
  });
  if (!admin || !q.data) return null;
  return (
    <Editor
      key={ws}
      integration={q.data}
      base={`/workspaces/${ws}/integrations`}
      refresh={() => q.refetch()}
    />
  );
}
function Editor({
  integration,
  base,
  refresh,
}: {
  integration: Integration;
  base: string;
  refresh: () => void;
}) {
  const [draft, set] = useState(integration.settings);
  const [tokenAction, setTokenAction] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [busy, pending] = useState(false);
  const { toast } = useToast();
  async function act(fn: () => Promise<unknown>) {
    pending(true);
    try {
      await fn();
      refresh();
      toast("Integration updated", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      pending(false);
    }
  }
  function changeToken(enable: boolean) {
    setTokenAction(null);
    void act(async () => {
      const res = await request<{ token: string | null }>(base + "/credential", {
        method: "POST", body: JSON.stringify(enable),
      });
      setToken(res.token ?? "");
    });
  }
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      {tokenAction !== null && <ConfirmAction title={tokenAction ? "Rotate feed token?" : "Revoke feed token?"} description="Clients using the current token will lose access." action={tokenAction ? "Rotate token" : "Revoke token"} onCancel={() => setTokenAction(null)} onConfirm={() => changeToken(tokenAction)} />}
      <h2 className="font-semibold">Integrations and automation</h2>
      <fieldset className="space-y-3" disabled={busy}>
        {["issue.created", "issue.status_changed", "issue.due"].map((ev) => (
          <label className="flex gap-2" key={ev}>
            <input
              type="checkbox"
              checked={draft.events.includes(ev)}
              onChange={(e) =>
                set({
                  ...draft,
                  events: e.target.checked
                    ? [...draft.events, ev]
                    : draft.events.filter((v) => v !== ev),
                })
              }
            />
            {ev}
          </label>
        ))}
        <label className="block text-sm">
          Webhook destination
          <SelectBox fullWidth
            value={draft.destination}
            onChange={(e) => set({ ...draft, destination: e.target.value })}
          >
            <option value="">Event feed only</option>
            {integration.destinations.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </SelectBox>
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={draft.notify_assignee}
            onChange={(e) =>
              set({ ...draft, notify_assignee: e.target.checked })
            }
          />
          Notify the issue assignee
        </label>
        <Button
          onClick={() =>
            act(() =>
              request(base, { method: "PUT", body: JSON.stringify(draft) }),
            )
          }
        >
          Save rules
        </Button>
        <p className="text-sm">Read-only event feed</p>
        <code className="block break-all text-xs">
          {location.origin}/api/v1{base}/events?after=0
        </code>
        <div className="flex gap-2">
          {[true, false]
            .filter((enable) => enable || integration.settings.credential)
            .map((enable) => (
              <Button
                key={String(enable)}
                size="sm"
                variant="secondary"
                onClick={() => integration.settings.credential ? setTokenAction(enable) : changeToken(enable)}
              >
                {enable
                  ? integration.settings.credential
                    ? "Rotate token"
                    : "Create token"
                  : "Revoke token"}
              </Button>
            ))}
        </div>
        {token && (
          <label className="block text-sm">
            Copy this bearer token now
            <input
              className={control}
              readOnly
              value={token}
              onFocus={(e) => e.target.select()}
            />
          </label>
        )}
        <details>
          <summary>Recent events ({integration.history.length})</summary>
          {integration.history.map((h) => (
            <div
              key={h.id}
              className="flex justify-between gap-3 border-b border-border py-2 text-xs"
            >
              <span>
                {h.event} ·{" "}
                {h.destination
                  ? h.delivered
                    ? "Delivered"
                    : h.attempts >= 5
                      ? "Failed"
                      : "Pending"
                  : "Feed"}{" "}
                · {new Date(h.created_at).toLocaleString()}
              </span>
              {!h.delivered && h.attempts >= 5 && (
                <button
                  onClick={() =>
                    act(() =>
                      request(base + "/events/" + h.id + "/retry", {
                        method: "POST",
                      }),
                    )
                  }
                >
                  Retry
                </button>
              )}
            </div>
          ))}
        </details>
      </fieldset>
    </section>
  );
}
