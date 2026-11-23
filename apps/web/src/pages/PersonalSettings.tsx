import { SelectBox } from "../components/ui/SelectBox";
import {useTranslation} from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useConfiguration } from "../context/useConfiguration";
import { request } from "../lib/api";
import { useState } from "react";
import { control } from "../components/CustomFields";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";
interface Preferences {
  timezone: string;
  language: string;
  notify: boolean;
}
export function usePreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["personal-preferences", user?.id],
    enabled: !!user,
    queryFn: () => request<Preferences>("/auth/preferences"),
  });
}
export function useCalendar() {
  const prefs = usePreferences().data;
  const org = useConfiguration().data?.configuration;
  const zone =
    prefs?.timezone ||
    org?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = prefs?.language || undefined;
  return {
    day: (date = new Date()) =>
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date),
    display: (value: string) =>
      new Date(value).toLocaleDateString(locale, {
        timeZone: zone,
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
  };
}
export function PersonalSettings() {
  const q = usePreferences();
  const { user } = useAuth();
  return q.data && user ? (
    <Editor key={user.id} userId={user.id} initial={q.data} />
  ) : null;
}
function Editor({ userId, initial }: { userId: string; initial: Preferences }) {
  const {t}=useTranslation();
  const [draft, set] = useState(initial);
  const [busy, pending] = useState(false);
  const client = useQueryClient();
  const { toast } = useToast();
  return (
    <form
      className="rounded-xl border border-border bg-card p-5 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        pending(true);
        try {
          const p = await request<Preferences>("/auth/preferences", {
            method: "PUT",
            body: JSON.stringify(draft),
          });
          client.setQueryData(["personal-preferences", userId], p);
          toast("Preferences saved", "success");
        } catch (e) {
          toast(e instanceof Error ? e.message : "Save failed", "error");
        } finally {
          pending(false);
        }
      }}
    >
      <h2 className="font-semibold">{t("Personal preferences")}</h2>
      <label className="block text-sm">
        {t("Time zone")}
        <input
          className={control}
          placeholder="Use organization time zone"
          value={draft.timezone}
          onChange={(e) => set({ ...draft, timezone: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        {t("Language")}
        <SelectBox fullWidth
          value={draft.language}
          onChange={(e) => set({ ...draft, language: e.target.value })}
        >
          <option value="">{t("Browser language")}</option>
          <option value="en-GB">English (UK)</option>
          <option value="en-US">English (US)</option>
          <option value="sv-SE">Svenska</option>
        </SelectBox>
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={draft.notify}
          onChange={(e) => set({ ...draft, notify: e.target.checked })}
        />
        Receive organization automation notifications
      </label>
      <Button size="sm" isLoading={busy}>
        {t("Save preferences")}
      </Button>
    </form>
  );
}
