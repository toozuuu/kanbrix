CREATE TABLE IF NOT EXISTS workspace_email_settings (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    provider VARCHAR(32) NOT NULL DEFAULT 'resend',
    from_email TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT 'Kanbrix',
    reply_to TEXT,
    api_url TEXT,
    domain TEXT,
    api_key TEXT,
    send_invites BOOLEAN NOT NULL DEFAULT true,
    send_notifications BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
