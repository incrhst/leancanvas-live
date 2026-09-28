"use client";

import React from "react";
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://dummy-preview.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Convenience hook over Convex Auth: the signed-in user's profile, loading state, and sign out.
 */
export function useAuth() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profile = useQuery(api.users.getMyProfile, isAuthenticated ? {} : "skip");

  const user: AuthUser | null =
    isAuthenticated && profile
      ? {
          id: profile._id,
          email: profile.email ?? "",
          name: profile.name || profile.email?.split("@")[0] || "You",
        }
      : null;

  return {
    user,
    isLoading: authLoading || (isAuthenticated && profile === undefined),
    logout: () => void signOut(),
  };
}

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>;
}
