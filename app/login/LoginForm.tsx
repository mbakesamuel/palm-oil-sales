"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel, roleRequiresSalesPoint } from "@/lib/auth-display";
import type { AuthSalesPoint } from "@/lib/auth-session";

type LoginUser = { id: string; name: string; role: UserRole };

export function LoginForm(props: {
  salesPoints: AuthSalesPoint[];
  users: LoginUser[];
  companyName: string;
  department: string | null;
}) {
  const { salesPoints, users, companyName, department } = props;
  const router = useRouter();
  const { signIn } = useAuth();

  const [userId, setUserId] = React.useState<string>(users[0]?.id ?? "");
  const [salesPointId, setSalesPointId] = React.useState<string>(
    salesPoints[0] ? String(salesPoints[0].id) : "",
  );
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const u = users.find((x) => x.id === userId);
    if (!u) {
      setError("Select a user.");
      return;
    }
    const role = u.role;
    if (roleRequiresSalesPoint(role)) {
      const id = Number.parseInt(salesPointId, 10);
      const sp = salesPoints.find((p) => p.id === id);
      if (!sp) {
        setError("Select a sales point for this role.");
        return;
      }
      signIn({
        userId: u.id,
        username: u.name,
        role,
        salesPoint: { id: sp.id, name: sp.name },
      });
    } else {
      signIn({ userId: u.id, username: u.name, role, salesPoint: null });
    }
    router.push("/dashboard");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-black/10 dark:border-white/10 p-6 space-y-4"
    >
      <div className="space-y-1 pb-1 border-b border-black/10 dark:border-white/10">
        {department?.trim() ? (
          <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
            {department.trim()}
          </div>
        ) : null}
        <div className="text-sm font-medium opacity-80">{companyName}</div>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="text-sm opacity-75">
          Dummy sign-in: choose a role and sales point (if applicable). Session is stored in the
          browser only.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="user">
          User
        </label>
        <select
          id="user"
          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        >
          {users.length === 0 ? (
            <option value="">No users — add one in Setup first</option>
          ) : (
            users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({roleLabel(u.role)})
              </option>
            ))
          )}
        </select>
      </div>

      {users.find((u) => u.id === userId) ? (
        <p className="text-xs opacity-70 rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
          Role:{" "}
          <span className="font-medium">
            {roleLabel(users.find((u) => u.id === userId)!.role)}
          </span>
        </p>
      ) : null}

      {roleRequiresSalesPoint(users.find((u) => u.id === userId)?.role ?? UserRole.CLERK) ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="salesPoint">
            Sales point
          </label>
          <select
            id="salesPoint"
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            value={salesPointId}
            onChange={(e) => setSalesPointId(e.target.value)}
            required
          >
            {salesPoints.length === 0 ? (
              <option value="">No sales points — add one first</option>
            ) : (
              salesPoints.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))
            )}
          </select>
        </div>
      ) : (
        <p className="text-xs opacity-70 rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
          Manager and admin roles are not tied to a single sales point.
        </p>
      )}

      {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}

      <button
        type="submit"
        className="w-full rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium"
      >
        Sign in
      </button>
    </form>
  );
}
