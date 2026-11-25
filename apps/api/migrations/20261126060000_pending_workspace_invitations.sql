CREATE UNIQUE INDEX idx_workspace_invitations_pending_email
    ON workspace_invitations (workspace_id, email)
    WHERE accepted_at IS NULL;
