import { PersonalSettings } from "./PersonalSettings";
import { WorkflowSettings } from "./WorkflowSettings";
import { IntegrationSettings } from "./IntegrationSettings";
import { OrganizationSettings } from "./OrganizationSettings";
import React, { useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { Settings, Shield, Server } from "lucide-react";

export function SettingsPage() {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !workspaceName.trim()) return;

    try {
      setIsLoading(true);
      await api.workspaces.update(currentWorkspace.id, { name: workspaceName.trim() });
      toast("Workspace updated successfully!", "success");
      refreshWorkspaces();
    } catch (err: any) {
      toast(err.message || "Failed to update workspace", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const canManage = currentWorkspace?.role === "Owner" || currentWorkspace?.role === "Admin";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="pb-3 border-b border-border/50">
        <h1 className="text-base font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage workspace settings and review system information.
        </p>
      </div>

      {/* Workspace Settings Card */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Workspace Profile</h2>
        </div>

        <form onSubmit={handleUpdateWorkspace} className="space-y-4">
          <Input
            label="Workspace Name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            disabled={!canManage}
            required
          />

          <Input
            label="Workspace Slug (Immutable)"
            value={currentWorkspace?.slug || ""}
            disabled
            helperText="Permanent identifier for URLs and tenant boundary"
          />

          {canManage && (
            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" isLoading={isLoading}>
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </div>

      <PersonalSettings/>
      <OrganizationSettings/>
      <WorkflowSettings/>
      <IntegrationSettings/>
      {/* User Account Card */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Your Account</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted-foreground block">Name</span>
            <span className="font-semibold text-foreground">{user?.name}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Email</span>
            <span className="font-semibold text-foreground">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">System & Architecture</h2>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between py-1 border-b border-border/40">
            <span>Application Version</span>
            <span className="font-mono text-foreground font-semibold">0.1.0</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/40">
            <span>Backend Runtime</span>
            <span className="text-foreground">Rust (Axum + Tokio + SQLx)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/40">
            <span>Frontend Stack</span>
            <span className="text-foreground">React 18 + Vite + Tailwind CSS</span>
          </div>
          <div className="flex justify-between py-1">
            <span>License</span>
            <span className="font-semibold text-foreground">GNU AGPL-3.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
