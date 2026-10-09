/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as canvases from "../canvases.js";
import type * as checkIns from "../checkIns.js";
import type * as constants_prompts from "../constants/prompts.js";
import type * as crons from "../crons.js";
import type * as decisions from "../decisions.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_canvasTemplates from "../lib/canvasTemplates.js";
import type * as lib_checkIns from "../lib/checkIns.js";
import type * as lib_decisions from "../lib/decisions.js";
import type * as lib_history from "../lib/history.js";
import type * as lib_markets from "../lib/markets.js";
import type * as lib_members from "../lib/members.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_review from "../lib/review.js";
import type * as lib_snapshots from "../lib/snapshots.js";
import type * as lib_testFields from "../lib/testFields.js";
import type * as mcp from "../mcp.js";
import type * as notes from "../notes.js";
import type * as oauth from "../oauth.js";
import type * as presence from "../presence.js";
import type * as review from "../review.js";
import type * as snapshots from "../snapshots.js";
import type * as stressTests from "../stressTests.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  canvases: typeof canvases;
  checkIns: typeof checkIns;
  "constants/prompts": typeof constants_prompts;
  crons: typeof crons;
  decisions: typeof decisions;
  email: typeof email;
  http: typeof http;
  invites: typeof invites;
  "lib/auth": typeof lib_auth;
  "lib/canvasTemplates": typeof lib_canvasTemplates;
  "lib/checkIns": typeof lib_checkIns;
  "lib/decisions": typeof lib_decisions;
  "lib/history": typeof lib_history;
  "lib/markets": typeof lib_markets;
  "lib/members": typeof lib_members;
  "lib/notify": typeof lib_notify;
  "lib/password": typeof lib_password;
  "lib/review": typeof lib_review;
  "lib/snapshots": typeof lib_snapshots;
  "lib/testFields": typeof lib_testFields;
  mcp: typeof mcp;
  notes: typeof notes;
  oauth: typeof oauth;
  presence: typeof presence;
  review: typeof review;
  snapshots: typeof snapshots;
  stressTests: typeof stressTests;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
