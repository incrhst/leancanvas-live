"use client";

import React, { useState } from "react";
import { BotIcon, CheckIcon, CopyIcon } from "lucide-react";

const MCP_URL = "https://lean.incrementic.com/api/mcp";

const ANTIGRAVITY_CONFIG = `{
  "mcpServers": {
    "leancanvas": {
      "serverUrl": "${MCP_URL}"
    }
  }
}`;

type AgentId = "chatgpt" | "claude" | "antigravity";

const AGENTS: { id: AgentId; label: string; steps: React.ReactNode[] }[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    steps: [
      <>
        Open <strong>Plugins</strong>, click <strong>Manage</strong> (the gear icon), then open{" "}
        <strong>MCPs</strong>.
      </>,
      <>
        Add an <strong>HTTP</strong> MCP and paste the URL above.
      </>,
      <>Sign in with your LeanCanvas account when ChatGPT asks you to authorize access.</>,
    ],
  },
  {
    id: "claude",
    label: "Claude",
    steps: [
      <>
        Go to <strong>Customize &gt; Connectors</strong> and click <strong>Add custom connector</strong>.
      </>,
      <>
        Paste the URL above as the MCP server URL. If asked how to authenticate, leave it on sign-in and
        choose <strong>Register automatically</strong> for the OAuth client.
      </>,
      <>
        Click <strong>Add</strong>, then sign in with your LeanCanvas account.
      </>,
      <>
        In a chat, click <strong>+</strong> and select <strong>Connectors</strong> to turn LeanCanvas on.
      </>,
    ],
  },
  {
    id: "antigravity",
    label: "Antigravity",
    steps: [
      <>
        In the Agent panel, open the <strong>...</strong> menu, choose <strong>MCP Servers</strong>, then{" "}
        <strong>Manage MCP Servers</strong>, and click <strong>View raw config</strong>.
      </>,
      <>
        Add this entry under <code>mcpServers</code>, then save and restart Antigravity:
        <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-[11px] text-incrementic-charcoal">
          <code>{ANTIGRAVITY_CONFIG}</code>
        </pre>
      </>,
      <>
        Open <strong>Agent Settings</strong>, go to the <strong>Customizations</strong> tab, and click{" "}
        <strong>Authenticate</strong> next to LeanCanvas. Finish signing in, then paste the authorization code
        back in and click <strong>Submit</strong>.
      </>,
    ],
  },
];

export function AgentConnectInstructions() {
  const [activeId, setActiveId] = useState<AgentId>("chatgpt");
  const [copied, setCopied] = useState(false);

  const active = AGENTS.find((agent) => agent.id === activeId) ?? AGENTS[0];

  const copyMcpUrl = () => {
    navigator.clipboard?.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-surface border border-line p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-incrementic-soft border border-incrementic-hair text-incrementic-red flex items-center justify-center">
            <BotIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm text-ink">Instructions for your agent</h3>
            <p className="text-xs text-muted">Connect your agent to interact with your canvases.</p>
          </div>
        </div>

        {/* MCP URL copy */}
        <div className="flex items-center gap-2 bg-surface-2 border border-line rounded-lg p-1.5 max-w-md w-full sm:w-auto">
          <span className="font-mono text-[11px] text-incrementic-charcoal select-all truncate px-2">{MCP_URL}</span>
          <button
            type="button"
            onClick={copyMcpUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-incrementic-ink text-white rounded-md text-xs font-semibold hover:bg-black transition-colors shrink-0"
          >
            {copied ? (
              <>
                <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <CopyIcon className="w-3.5 h-3.5" />
                Copy URL
              </>
            )}
          </button>
        </div>
      </div>

      {/* Agent tabs */}
      <div role="tablist" aria-label="Choose your agent" className="flex flex-wrap gap-1.5">
        {AGENTS.map((agent) => {
          const selected = agent.id === active.id;
          return (
            <button
              key={agent.id}
              type="button"
              role="tab"
              id={`agent-tab-${agent.id}`}
              aria-selected={selected}
              aria-controls={`agent-panel-${agent.id}`}
              onClick={() => setActiveId(agent.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                selected
                  ? "bg-incrementic-ink text-white"
                  : "bg-surface-2 text-muted hover:text-ink border border-line"
              }`}
            >
              {agent.label}
            </button>
          );
        })}
      </div>

      {/* Steps for the selected agent */}
      <div role="tabpanel" id={`agent-panel-${active.id}`} aria-labelledby={`agent-tab-${active.id}`}>
        <ol className="space-y-2.5 text-xs text-muted">
          {active.steps.map((step, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-incrementic-hair text-ink font-mono font-semibold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">{step}</div>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-muted pt-3 border-t border-line/60">
        Then ask your agent: <em>&quot;Review my Lean Canvas and find the 3 riskiest assumptions.&quot;</em>
      </p>
    </div>
  );
}
