import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Sends a plain-text email through Resend, using the same key and sender as sign-in emails.
 * Without a key (e.g. a fresh dev deployment) it logs and skips, so requests still go through.
 */
export const send = internalAction({
  args: { to: v.string(), subject: v.string(), text: v.string() },
  handler: async (_ctx, args) => {
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      console.warn(`AUTH_RESEND_KEY not set; not emailing ${args.to}: ${args.subject}`);
      return null;
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? "LeanCanvas <onboarding@resend.dev>",
        to: [args.to],
        subject: args.subject,
        text: args.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend error ${response.status}: ${await response.text()}`);
    }
    return null;
  },
});
