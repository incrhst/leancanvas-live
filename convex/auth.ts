import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import { MutationCtx } from "./_generated/server";
import { linkPeopleToUser } from "./lib/people";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM ?? "LeanOn <onboarding@resend.dev>",
    }),
  ],
  callbacks: {
    // Anyone asked to decide before they had an account gets those decisions in the app once they
    // sign in with that email (runs on every sign-in, so people added later get linked too)
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      await linkPeopleToUser(ctx as unknown as MutationCtx, userId);
    },
  },
});
