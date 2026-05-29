"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel } from "@/lib/auth-display";

export function DashboardSessionCard() {
  const { status, session } = useAuth();

  if (status !== "ready") {
    return (
      <div className="rounded-lg border border-border p-4 text-sm opacity-70">
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        <p className="font-medium">You are not signed in</p>
        <p className="mt-1 opacity-90">
          <Link href="/login" className="underline font-medium">
            Go to login
          </Link>{" "}
          to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4 text-sm space-y-1">
      <div className="font-medium">Signed in as {session.username}</div>
      <div className="opacity-80">{roleLabel(session.role)}</div>
      {session.factory ? (
        <div className="opacity-80">Factory: {session.factory.name}</div>
      ) : session.salesPoint ? (
        <div className="opacity-80">Sales point: {session.salesPoint.name}</div>
      ) : (
        <div className="opacity-80">All sites</div>
      )}
      {session.commercialService ? (
        <div className="opacity-80">Commercial line: {session.commercialService.name}</div>
      ) : null}
    </div>
  );
}
