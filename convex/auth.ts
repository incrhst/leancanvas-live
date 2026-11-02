import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // Reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET. Google verifies emails, so a Google
    // sign-in links to an existing magic-link account with the same address.
    Google,
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM ?? "CriticalDash <onboarding@resend.dev>",
    }),
  ],
});
