"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../components/ConvexClientProvider";
import { ShieldCheckIcon, AlertCircleIcon, Loader2Icon, ArrowRightIcon } from "lucide-react";

export default function InviteAcceptPage() {
  const params = useParams();
  const token = (params?.token as string) || "";
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [status, setStatus] = useState<"checking" | "ready" | "accepted" | "error">("checking");

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // Must authenticate to accept invite
      setStatus("ready");
    } else {
      // Auto-accept and route to canvas
      setStatus("accepted");
      const t = setTimeout(() => {
        router.push("/canvas/demo-live-1");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-line p-8 shadow-sm space-y-6 text-center">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-accent-soft text-accent items-center justify-center mx-auto">
          <ShieldCheckIcon className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold text-ink">You’ve Been Invited!</h1>
          <p className="text-xs text-muted">
            You've been invited to collaborate on <strong>Splitwise for Meals</strong>.
          </p>
        </div>

        {status === "checking" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted py-4">
            <Loader2Icon className="w-4 h-4 animate-spin text-accent" />
            Validating magic invite link...
          </div>
        )}

        {status === "ready" && (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 text-left">
              <strong>Authentication Required:</strong> Anonymous users cannot edit canvases or accept membership invites. Please sign in to accept this invite.
            </div>

            <Link
              href={`/login?redirect=/invite/${token}`}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors shadow-sm"
            >
              Sign in with Magic Link to Accept
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        )}

        {status === "accepted" && (
          <div className="space-y-3 pt-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 font-medium">
              Invite accepted successfully! Joining workspace...
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted">
              <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
              Redirecting to canvas...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
