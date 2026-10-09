import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { blockValidator, canvasTemplateValidator } from "./lib/canvasTemplates";
import { testFieldsSchema } from "./lib/testFields";
import { decisionRequestValidator } from "./lib/decisions";

export default defineSchema({
  ...authTables,

  // Overrides the Convex Auth users table (fields must stay optional; index "email" is required by Convex Auth)
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // Short-lived viewing passes issued after entering a public link's password (stored hashed)
  publicViewGrants: defineTable({
    canvasId: v.id("canvases"),
    grantHash: v.string(),
    passwordSetAt: v.number(),
    expiresAt: v.number(),
  }).index("by_grant_hash", ["grantHash"]),

  // Failed public link password attempts, per viewer (hashed IP) and per canvas overall
  // (viewerKey unset = the canvas-wide counter)
  shareUnlockAttempts: defineTable({
    canvasId: v.id("canvases"),
    viewerKey: v.optional(v.string()),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_canvas_viewer", ["canvasId", "viewerKey"]),

  // OAuth 2.1 clients registered via RFC 7591 Dynamic Client Registration (e.g. Claude)
  oauthClients: defineTable({
    clientId: v.string(),
    clientName: v.string(),
    redirectUris: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_client_id", ["clientId"]),

  // Short-lived, single-use authorization codes (stored hashed)
  oauthCodes: defineTable({
    codeHash: v.string(),
    clientId: v.string(),
    userId: v.id("users"),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_code_hash", ["codeHash"]),

  // MCP access/refresh tokens (stored hashed)
  oauthTokens: defineTable({
    accessTokenHash: v.string(),
    refreshTokenHash: v.string(),
    clientId: v.string(),
    userId: v.id("users"),
    accessExpiresAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_access_hash", ["accessTokenHash"])
    .index("by_refresh_hash", ["refreshTokenHash"]),

  workspaces: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
  }).index("by_owner", ["ownerId"]),

  canvases: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    // Which block set this canvas uses. Unset on canvases created before templates (= lean). Fixed at creation.
    template: v.optional(canvasTemplateValidator),
    // Day 0 of the plan ("YYYY-MM-DD"), so review dates can read as "day 30"
    launchDate: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived")),
    // Public read-only link token (null = private)
    publicViewToken: v.optional(v.string()),
    // Whether the public link is currently enabled
    isPublicViewEnabled: v.boolean(),
    // Optional password on the public link (PBKDF2 hash) and when it was last set/cleared
    publicViewPasswordHash: v.optional(v.string()),
    publicViewPasswordSetAt: v.optional(v.number()),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_public_token", ["publicViewToken"])
    .index("by_creator", ["createdBy"]),

  // Membership at canvas level
  canvasMembers: defineTable({
    canvasId: v.id("canvases"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_user", ["userId"])
    .index("by_canvas_user", ["canvasId", "userId"]),

  // Sticky notes inside blocks
  notes: defineTable({
    canvasId: v.id("canvases"),
    // Must belong to the canvas's template; checked in notes.ts
    block: blockValidator,
    content: v.string(),
    order: v.number(),
    evidenceState: v.union(
      v.literal("unknown"),
      v.literal("assumption"),
      v.literal("observed"),
      v.literal("supported"),
      v.literal("contradicted"),
      v.literal("decision")
    ),
    // Optional test: measure, passMark, reviewDate, latestResult
    ...testFieldsSchema,
    // The one person responsible for this note; any canvas member, viewers included
    ownerId: v.optional(v.id("users")),
    // A decision someone has been asked to make about this note
    decision: v.optional(decisionRequestValidator),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_canvas_block", ["canvasId", "block"])
    .index("by_decider_and_status", ["decision.deciderId", "decision.status"]),

  // One row per change to a note. Rows outlive the note, so a deleted note's history stays readable.
  noteHistory: defineTable({
    canvasId: v.id("canvases"),
    noteId: v.id("notes"),
    userId: v.id("users"),
    // Where the change came from; an MCP token acts as its user, so this tells agent edits apart
    via: v.union(v.literal("ui"), v.literal("mcp")),
    clientName: v.optional(v.string()),
    kind: v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("deleted"),
      v.literal("decision_requested"),
      v.literal("decision_answered"),
      v.literal("decision_withdrawn")
    ),
    changes: v.array(
      v.object({
        field: v.string(),
        from: v.optional(v.string()),
        to: v.optional(v.string()),
      })
    ),
    reason: v.optional(v.string()),
    link: v.optional(v.string()),
    // Time of the latest change folded into this row (see recordNoteHistory)
    at: v.number(),
  })
    .index("by_note", ["noteId"])
    .index("by_canvas", ["canvasId"]),

  evidence: defineTable({
    noteId: v.id("notes"),
    type: v.union(v.literal("text"), v.literal("url"), v.literal("file")),
    content: v.string(), // text or url
    fileId: v.optional(v.id("_storage")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_note", ["noteId"]),

  stressTests: defineTable({
    canvasId: v.id("canvases"),
    scores: v.object({
      clarity: v.number(),
      desirability: v.number(),
      viability: v.number(),
      feasibility: v.number(),
      defensibility: v.number(),
      timing: v.number(),
      mission: v.number(),
    }),
    overallScore: v.number(),
    riskiestAssumptions: v.array(
      v.object({
        noteId: v.optional(v.id("notes")),
        block: v.string(),
        assumption: v.string(),
        reason: v.string(),
        suggestedExperiment: v.string(),
      })
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_canvas", ["canvasId"]),

  invites: defineTable({
    canvasId: v.id("canvases"),
    email: v.optional(v.string()), // null for link-only
    role: v.union(v.literal("editor"), v.literal("viewer")),
    token: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdBy: v.id("users"),
  })
    .index("by_token", ["token"])
    .index("by_canvas", ["canvasId"]),

  activity: defineTable({
    canvasId: v.id("canvases"),
    userId: v.optional(v.id("users")), // null for system
    type: v.string(),
    message: v.string(),
    createdAt: v.number(),
  }).index("by_canvas", ["canvasId"]),

  presence: defineTable({
    canvasId: v.id("canvases"),
    userId: v.id("users"),
    userName: v.string(),
    userEmail: v.string(),
    userAvatar: v.optional(v.string()),
    currentBlock: v.optional(v.string()),
    cursorX: v.optional(v.number()),
    cursorY: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_canvas_user", ["canvasId", "userId"])
    .index("by_updated", ["updatedAt"]),
});
