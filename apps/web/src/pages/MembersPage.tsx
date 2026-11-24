import { ProjectSpinner } from "../components/ui/ProjectSpinner";
import { SelectBox } from "../components/ui/SelectBox";
import React, { useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { api } from "../lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Avatar } from "../components/ui/Avatar";
import { useToast } from "../components/ui/Toast";
import { formatDate } from "../lib/utils";
import { UserPlus, Shield } from "lucide-react";

export function MembersPage() {
  const { currentWorkspace } = useWorkspace();
  const client = useQueryClient();
  const workspaceId = currentWorkspace?.id;
  const memberKey = ["workspace-members", workspaceId];
  const memberQuery = useQuery({
    queryKey: memberKey,
    enabled: Boolean(workspaceId),
    queryFn: () => api.workspaces.members(workspaceId!),
  });
  const members = memberQuery.data ?? [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Member");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !email.trim()) return;

    try {
      setIsLoading(true);
      await api.workspaces.invite(currentWorkspace.id, { email: email.trim(), role });
      toast("Invitation sent successfully!", "success");
      setEmail("");
      setIsModalOpen(false);
      void client.invalidateQueries({queryKey: memberKey});
    } catch (err: any) {
      toast(err.message || "Failed to invite member", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const canManage = currentWorkspace?.role === "Owner" || currentWorkspace?.role === "Admin";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 className="page-heading">Team Members</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage who has access to the <span className="font-semibold text-foreground">{currentWorkspace?.name}</span> workspace.
          </p>
        </div>

        {canManage && (
          <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            <span>Invite Member</span>
          </Button>
        )}
      </div>

      {workspaceId && memberQuery.isPending && <ProjectSpinner size="sm" message="Loading members."/>}
      {memberQuery.isError && <p role="alert">Could not load members. <button className="underline" onClick={() => void memberQuery.refetch()}>Retry</button></p>}
      {/* Members Table */}
      <div role="region" aria-label="Workspace members" tabIndex={0} className="max-w-full overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            <tr>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {members.map((m) => (
              <tr key={m.user_id} className="hover:bg-accent/30 transition-colors">
                <td className="py-3 px-4 flex items-center gap-2.5">
                  <Avatar name={m.name} size="sm" />
                  <span className="font-semibold text-foreground">{m.name}</span>
                </td>
                <td className="py-3 px-4 text-muted-foreground">{m.email}</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full border border-border bg-secondary text-xs">
                    <Shield className="h-3 w-3 text-primary" />
                    {m.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-muted-foreground">{formatDate(m.joined_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Invite Member to Workspace"
        description="Invited members will receive access to all projects inside this workspace."
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <Input
            type="email"
            label="User Email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground/80 tracking-wide">
              Workspace Role
            </label>
            <SelectBox fullWidth id="workspace-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="Admin">Admin (can manage settings and invite members)</option>
              <option value="Member">Member (can create and edit issues)</option>
              <option value="Viewer">Viewer (read-only access)</option>
            </SelectBox>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
