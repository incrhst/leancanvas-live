import React, { useState } from "react";
import { Share2Icon, CopyIcon, CheckIcon, LockIcon, GlobeIcon, MailIcon, ShieldCheckIcon } from "lucide-react";

interface ShareModalProps {
  canvasId: string;
  isPublicViewEnabled: boolean;
  publicViewToken?: string;
  isOwner: boolean;
  onTogglePublic: (enabled: boolean) => Promise<void>;
  onCreateInvite: (role: "editor" | "viewer", email?: string) => Promise<string>;
  onClose: () => void;
}

export function ShareModal({
  canvasId,
  isPublicViewEnabled,
  publicViewToken,
  isOwner,
  onTogglePublic,
  onCreateInvite,
  onClose,
}: ShareModalProps) {
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [loading, setLoading] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicShareUrl = publicViewToken ? `${origin}/share/${publicViewToken}` : "";

  const handleCopyPublic = async () => {
    if (!publicShareUrl) return;
    await navigator.clipboard.writeText(publicShareUrl);
    setCopiedPublic(true);
    setTimeout(() => setCopiedPublic(false), 2000);
  };

  const handleCreateInviteLink = async () => {
    setLoading(true);
    try {
      const token = await onCreateInvite(inviteRole, inviteEmail || undefined);
      const url = `${origin}/invite/${token}`;
      setGeneratedInviteLink(url);
      setInviteEmail("");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!generatedInviteLink) return;
    await navigator.clipboard.writeText(generatedInviteLink);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl border border-line space-y-6">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Share2Icon className="w-5 h-5 text-accent" />
            <h2 className="text-base font-semibold text-ink">Share & Invite</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-sm p-1 rounded hover:bg-stone-100"
          >
            ✕
          </button>
        </div>

        {/* Section 1: Public Read-Only Link (Anonymous viewing) */}
        <div className="space-y-3 rounded-xl bg-surface-2 border border-line p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium text-xs text-ink">
                <GlobeIcon className="w-4 h-4 text-emerald-600" />
                Public Read-Only Link
              </div>
              <p className="text-[11px] text-muted">
                Anyone with this link can view the canvas. <strong>No anonymous editing allowed.</strong>
              </p>
            </div>
            {isOwner && (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublicViewEnabled}
                  onChange={(e) => onTogglePublic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            )}
          </div>

          {isPublicViewEnabled && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={publicShareUrl}
                className="w-full text-xs bg-white border border-line rounded-lg px-2.5 py-1.5 text-muted select-all focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleCopyPublic}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-ink text-surface rounded-lg text-xs font-medium hover:bg-ink/90 shrink-0 transition-colors"
              >
                {copiedPublic ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" /> : <CopyIcon className="w-3.5 h-3.5" />}
                {copiedPublic ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Team Invites (Magic Links) */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 font-medium text-xs text-ink">
            <LockIcon className="w-4 h-4 text-accent" />
            Invite Collaborators (Requires Sign In)
          </div>
          <p className="text-[11px] text-muted">
            Recipients must authenticate to accept and access the canvas.
          </p>

          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Optional email (or leave blank for link)"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 text-xs border border-line rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                className="text-xs border border-line rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
              >
                <option value="editor">Editor (Can edit)</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleCreateInviteLink}
              className="w-full py-2 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              Generate Invite Magic Link
            </button>
          </div>

          {generatedInviteLink && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-900 font-medium">
                <span className="flex items-center gap-1">
                  <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
                  Invite link ready!
                </span>
                <span className="text-[10px] text-emerald-700">Expires in 14 days</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedInviteLink}
                  className="w-full text-[11px] bg-white border border-emerald-300 rounded px-2 py-1 text-emerald-950 font-mono select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="px-2.5 py-1 bg-emerald-700 text-white rounded text-xs font-medium hover:bg-emerald-800 shrink-0"
                >
                  {copiedInvite ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
