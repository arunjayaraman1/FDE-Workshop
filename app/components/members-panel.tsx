"use client";

import { useCallback, useEffect, useState } from "react";
import type { GithubInviteState, Membership, ProjectRole } from "@/lib/types";
import { Badge, Card, CardHeader, CopyButton, EmptyState, IconBox } from "./ui";

interface InviteRow {
  tokenHash: string;
  role: ProjectRole;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  state: "pending" | "accepted" | "expired";
}

interface MembersPanelProps {
  projectId: string;
  projectName: string;
  role: ProjectRole;
  canManage: boolean;
}

function roleBadge(role: ProjectRole) {
  return role === "owner" ? "pill warn" : "pill info";
}

function githubStateMeta(state: GithubInviteState): { label: string; className: string } {
  switch (state) {
    case "active":
      return { label: "GitHub: collaborator", className: "pill ok" };
    case "pending":
      return { label: "GitHub: invite sent", className: "pill warn" };
    case "failed":
      return { label: "GitHub: failed", className: "pill err" };
    default:
      return { label: "No GitHub link", className: "pill flat" };
  }
}

export default function MembersPanel({
  projectId,
  projectName,
  role,
  canManage,
}: MembersPanelProps) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<ProjectRole>("member");
  const [creating, setCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load members.");
        return;
      }
      setMembers(data.members ?? []);
      setInvites(data.invites ?? []);
      setError(null);
    } catch {
      setError("Failed to reach the Launchpad server.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateInvite() {
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create the invite.");
        return;
      }
      setInviteUrl(data.url);
      setNotice(`Invite link created (${inviteRole}). It expires in 7 days.`);
      await load();
    } catch {
      setError("Network error while creating the invite.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId: string, nextRole: ProjectRole) {
    setBusyUser(userId);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to change the role.");
        return;
      }
      await load();
    } catch {
      setError("Network error while changing the role.");
    } finally {
      setBusyUser(null);
    }
  }

  async function handleRemove(userId: string, username: string) {
    if (!confirm(`Remove ${username} from "${projectName}"?`)) return;
    setBusyUser(userId);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to remove the member.");
        return;
      }
      await load();
    } catch {
      setError("Network error while removing the member.");
    } finally {
      setBusyUser(null);
    }
  }

  async function handleRevoke(tokenHash: string) {
    setBusyUser(tokenHash);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/invites/${tokenHash}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to revoke the invite.");
        return;
      }
      await load();
    } catch {
      setError("Network error while revoking the invite.");
    } finally {
      setBusyUser(null);
    }
  }

  return (
    <div className="set-grid">
      {(error || notice) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <div className="alert-error">{error}</div>}
          {notice && <div className="alert-ok">{notice}</div>}
        </div>
      )}

      {canManage && (
        <Card>
          <CardHeader icon={<IconBox className="icon" />} title="Invite a member" />
          <div className="card-bd">
            <p className="pmute" style={{ marginBottom: 14 }}>
              Invite links are single-use and expire after 7 days. The person you invite chooses
              their username and GitHub handle when they accept.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
                className="input"
                style={{ width: 160 }}
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
              <button
                type="button"
                onClick={handleCreateInvite}
                disabled={creating}
                className="btn primary"
              >
                {creating ? "Creating…" : "Generate invite link"}
              </button>
            </div>
            {inviteUrl && (
              <div className="invite-wrap" style={{ marginTop: 14 }}>
                <div className="invite-link">{inviteUrl}</div>
                <CopyButton text={inviteUrl} iconOnly />
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          icon={<IconBox className="icon" />}
          title="Members"
          count={members.length}
        />
        {loading ? (
          <div style={{ padding: 20 }}>
            <p className="pmute">Loading…</p>
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<IconBox className="icon" />}
            title="No members yet"
            hint="Generate an invite link to add the first member."
          />
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>GitHub</th>
                  <th className="!text-right" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const gh = githubStateMeta(m.githubInviteState);
                  return (
                    <tr key={m.userId}>
                      <td>
                        <div className="member-cell">
                          <div>
                            <div className="m-name">{m.username}</div>
                            <div className="m-handle">@{m.username}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {canManage ? (
                          <select
                            value={m.role}
                            disabled={busyUser === m.userId}
                            onChange={(e) =>
                              handleRoleChange(m.userId, e.target.value as ProjectRole)
                            }
                            className="input"
                            style={{ width: 130, height: 32, padding: "6px 10px" }}
                          >
                            <option value="member">Member</option>
                            <option value="owner">Owner</option>
                          </select>
                        ) : (
                          <Badge className={roleBadge(m.role)}>{m.role}</Badge>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className="url-cell">{m.githubUsername ?? "—"}</span>
                          <span className={gh.className} title={m.githubInviteError}>
                            {gh.label}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="row-act">
                          {canManage && (
                            <button
                              type="button"
                              disabled={busyUser === m.userId}
                              onClick={() => handleRemove(m.userId, m.username)}
                              className="btn ghost sm danger-hover"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canManage && invites.length > 0 && (
        <Card>
          <CardHeader
            icon={<IconBox className="icon" />}
            title="Invites"
            count={invites.length}
          />
          <div style={{ padding: "4px 18px" }}>
            {invites.map((inv) => (
              <div key={inv.tokenHash} className="kv-row">
                <span className="k">{inv.role}</span>
                <Badge
                  className={inv.state === "pending" ? "pill warn" : "pill flat"}
                >
                  {inv.state}
                </Badge>
                <span className="pmute" style={{ flex: 1 }}>
                  by {inv.createdBy} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                </span>
                {inv.state === "pending" && (
                  <button
                    type="button"
                    disabled={busyUser === inv.tokenHash}
                    onClick={() => handleRevoke(inv.tokenHash)}
                    className="btn ghost sm danger-hover"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="pmute">
        Signed in as a project <span style={{ color: "var(--text-2)", fontWeight: 600 }}>{role}</span>.
        Access is scoped to this project; global admins see everything.
      </p>
    </div>
  );
}