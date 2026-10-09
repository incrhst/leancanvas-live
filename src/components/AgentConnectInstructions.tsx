"use client";

import React, { useState } from "react";
import { BotIcon, CheckIcon, ChevronDownIcon, CopyIcon } from "lucide-react";

const MCP_URL = "https://lean.incrementic.com/api/mcp";

const ANTIGRAVITY_CONFIG = `{
  "mcpServers": {
    "leancanvas": {
      "serverUrl": "${MCP_URL}"
    }
  }
}`;

type AgentId = "chatgpt" | "claude" | "gemini" | "antigravity";

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
    id: "gemini",
    label: "Gemini",
    steps: [
      <>
        Open <strong>Settings</strong> (the gear icon), go to <strong>Personal Intelligence</strong>, and open{" "}
        <strong>Custom Apps</strong>.
      </>,
      <>
        Scroll down and add a custom app with the URL above.
      </>,
      <>
        Sign in with your LeanCanvas account if asked, then approve access. If Gemini shows{" "}
        <em>&quot;Account linking is required to use this custom app. Please try again.&quot;</em>, try again. It
        connected on the second attempt when we tested it.
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

type AgentTool = {
  name: string;
  summary: string;
  detail: string;
  changesCanvas: boolean;
  inputs: { name: string; required: boolean }[];
};

// Plain-language view of the tools served by TOOLS_MANIFEST in src/app/api/mcp/route.ts.
// Keep the names and inputs in step with that manifest.
const AGENT_TOOLS: AgentTool[] = [
  {
    name: "list_canvases",
    summary: "See the canvases you own or can access.",
    detail: "Returns each canvas's ID, title, template, your role, and link.",
    changesCanvas: false,
    inputs: [],
  },
  {
    name: "create_canvas",
    summary: "Start a new Lean or GTM canvas.",
    detail: "Template is lean (the default) or gtm. Starter notes are added unless seedNotes is false.",
    changesCanvas: true,
    inputs: [
      { name: "title", required: true },
      { name: "description", required: false },
      { name: "template", required: false },
      { name: "seedNotes", required: false },
    ],
  },
  {
    name: "get_canvas",
    summary: "Read a canvas with its blocks and sticky notes.",
    detail: "Returns the canvas's template, each block's notes, and every note's evidence state.",
    changesCanvas: false,
    inputs: [{ name: "canvasId", required: true }],
  },
  {
    name: "add_note",
    summary: "Add a sticky note to a block on a canvas.",
    detail: "The block must belong to the canvas's template. Notes start as assumptions unless evidenceState is set.",
    changesCanvas: true,
    inputs: [
      { name: "canvasId", required: true },
      { name: "block", required: true },
      { name: "content", required: true },
      { name: "evidenceState", required: false },
      { name: "reason", required: false },
    ],
  },
  {
    name: "update_note",
    summary: "Reword a note, move it to another block, or change its state.",
    detail: "Pass only what changes. The change, and the reason if given, is kept in the note's history.",
    changesCanvas: true,
    inputs: [
      { name: "noteId", required: true },
      { name: "content", required: false },
      { name: "block", required: false },
      { name: "evidenceState", required: false },
      { name: "reason", required: false },
      { name: "link", required: false },
    ],
  },
  {
    name: "delete_note",
    summary: "Remove a note from a canvas.",
    detail: "The note's history, including its last text, stays readable.",
    changesCanvas: true,
    inputs: [
      { name: "noteId", required: true },
      { name: "reason", required: false },
    ],
  },
  {
    name: "get_note_history",
    summary: "See every change to a note, newest first.",
    detail: "Shows who changed what and when, whether it was done in the app or by an agent, and why. Works for deleted notes too.",
    changesCanvas: false,
    inputs: [{ name: "noteId", required: true }],
  },
  {
    name: "update_evidence_state",
    summary: "Change how a note is marked, such as assumption to observed.",
    detail: "Valid states: unknown, assumption, observed, supported, contradicted, decision.",
    changesCanvas: true,
    inputs: [
      { name: "noteId", required: true },
      { name: "evidenceState", required: true },
      { name: "reason", required: false },
    ],
  },
  {
    name: "run_stress_test",
    summary: "Score a canvas on 7 dimensions and surface its riskiest assumptions.",
    detail:
      "Lean canvases use Ash Maurya's methodology and GTM canvases use go-to-market criteria. The results are saved to the canvas.",
    changesCanvas: true,
    inputs: [{ name: "canvasId", required: true }],
  },
  {
    name: "export_canvas",
    summary: "Get a PDF or PNG of a canvas or its riskiest assumptions.",
    detail:
      "Returns a link. Open it signed in to LeanCanvas and the file downloads once the canvas loads. Riskiest assumptions need a stress test first.",
    changesCanvas: false,
    inputs: [
      { name: "canvasId", required: true },
      { name: "view", required: false },
      { name: "format", required: false },
    ],
  },
];

export function AgentConnectInstructions() {
  const [guideOpen, setGuideOpen] = useState(false);
  const [activeId, setActiveId] = useState<AgentId>("chatgpt");
  const [copied, setCopied] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [openToolName, setOpenToolName] = useState<string | null>(null);

  const active = AGENTS.find((agent) => agent.id === activeId) ?? AGENTS[0];

  const copyMcpUrl = () => {
    navigator.clipboard?.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-surface border border-line p-5 shadow-sm space-y-4">
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          guideOpen ? "pb-3 border-b border-line/70" : ""
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-incrementic-soft border border-incrementic-hair text-incrementic-red flex items-center justify-center">
            <BotIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm text-ink">Instructions for your agent</h3>
            <p className="text-xs text-muted">Connect your agent to interact with your canvases.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
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

          <button
            type="button"
            aria-expanded={guideOpen}
            aria-controls="agent-connect-guide"
            onClick={() => setGuideOpen((open) => !open)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-surface-2 transition-colors shrink-0"
          >
            Setup guide
            <ChevronDownIcon
              aria-hidden="true"
              className={`w-4 h-4 motion-safe:transition-transform ${guideOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {guideOpen && (
        <div id="agent-connect-guide" className="space-y-4">
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

          {/* Tools the agent gets. Level 1: names only. Level 2: a tool's details, opened on demand. */}
          <div className="rounded-xl border border-line bg-surface-2 overflow-hidden">
            <button
              type="button"
              aria-expanded={toolsOpen}
              aria-controls="agent-tools-list"
              onClick={() => setToolsOpen((open) => !open)}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left"
            >
              <span className="text-xs font-semibold text-ink">What your agent can do</span>
              <span className="flex items-center gap-2 text-[11px] text-muted">
                {AGENT_TOOLS.length} tools
                <ChevronDownIcon
                  aria-hidden="true"
                  className={`w-4 h-4 motion-safe:transition-transform ${toolsOpen ? "rotate-180" : ""}`}
                />
              </span>
            </button>

            {!toolsOpen && (
              <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
                {AGENT_TOOLS.map((tool) => (
                  <code
                    key={tool.name}
                    className="rounded-md bg-surface border border-line px-1.5 py-0.5 font-mono text-[10px] text-incrementic-charcoal"
                  >
                    {tool.name}
                  </code>
                ))}
              </div>
            )}

            <ul id="agent-tools-list" hidden={!toolsOpen} className="divide-y divide-line/70 border-t border-line bg-surface">
              {AGENT_TOOLS.map((tool) => {
                const open = openToolName === tool.name;
                return (
                  <li key={tool.name}>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`agent-tool-${tool.name}`}
                      onClick={() => setOpenToolName(open ? null : tool.name)}
                      className="w-full flex items-start justify-between gap-3 px-3.5 py-2.5 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <code className="block font-mono text-[11px] font-semibold text-ink">{tool.name}</code>
                        <span className="block mt-0.5 text-xs text-muted">{tool.summary}</span>
                      </span>
                      <ChevronDownIcon
                        aria-hidden="true"
                        className={`w-4 h-4 mt-0.5 shrink-0 text-muted motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </button>

                    <div id={`agent-tool-${tool.name}`} hidden={!open} className="space-y-2 px-3.5 pb-3 text-xs text-muted">
                      <p>{tool.detail}</p>
                      <p>
                        <span className="font-semibold text-ink">Access:</span>{" "}
                        {tool.changesCanvas ? "makes changes to the canvas" : "read only"}
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Inputs:</span>{" "}
                        {tool.inputs.length === 0
                          ? "none"
                          : tool.inputs.map((input, index) => (
                              <React.Fragment key={input.name}>
                                {index > 0 && ", "}
                                <code className="font-mono text-[11px] text-ink">{input.name}</code>
                                {input.required ? " (required)" : " (optional)"}
                              </React.Fragment>
                            ))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-xs text-muted pt-3 border-t border-line/60">
            Then ask your agent: <em>&quot;Review my Lean Canvas and find the 3 riskiest assumptions.&quot;</em>
          </p>
        </div>
      )}
    </div>
  );
}
