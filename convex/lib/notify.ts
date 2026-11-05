import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export function siteUrl() {
  return process.env.SITE_URL ?? "https://lean.incrementic.com";
}

/** Queues a plain-text email to a user (skipped if they have no email). */
export async function emailUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  message: { subject: string; text: string }
) {
  const user = await ctx.db.get(userId);
  if (!user?.email) return;
  await ctx.scheduler.runAfter(0, internal.email.send, { to: user.email, ...message });
}
