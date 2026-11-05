"use client";

import { createContext } from "react";

/**
 * The canvas's launch date (day 0), if it has one. Provided by the canvas and share pages.
 * Kept apart from testFields.ts so server code (the MCP route) can use the date helpers
 * without pulling in a client-only React context.
 */
export const LaunchDateContext = createContext<string | undefined>(undefined);
