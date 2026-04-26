"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel, roleRequiresSalesPoint } from "@/lib/auth-display";
import type { AuthSalesPoint } from "@/lib/auth-session";

const SALES_POINT_ROLES: UserRole[] = [UserRole.CLERK, UserRole.SUPERVISOR];

const CONSOLIDATION_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.ADMIN];

export function LoginForm(props: {
  salesPoints: AuthSalesPoint[];
  companyName: string;
  department: string | null;
}) {
  const { salesPoints, companyName, department } = props;
  const router = useRouter();
  const { signIn } = useAuth();

  const [username, setUsername] = React.useState("Demo user");
  const [role, setRole] = React.useState<UserRole>(UserRole.CLERK);
  const [salesPointId, setSalesPointId] = React.useState<string>(
    salesPoints[0] ? String(salesPoints[0].id) : "",
  );
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = username.trim();
    if (!name) {
      setError("Username is required.");
      return;
    }
    if (roleRequiresSalesPoint(role)) {
      const id = Number.parseInt(salesPointId, 10);
      const sp = salesPoints.find((p) => p.id === id);
      if (!sp) {
        setError("Select a sales point for this role.");
        return;
      }
      signIn({ username: name, role, salesPoint: { id: sp.id, name: sp.name } });
    } else {
      signIn({ username: name, role, salesPoint: null });
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
        <label className="text-sm font-medium" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
          autoComplete="username"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="role">
          Role
        </label>
        <select
          id="role"
          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          <optgroup label="Sales point">
            {SALES_POINT_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Consolidation">
            {CONSOLIDATION_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {roleRequiresSalesPoint(role) ? (
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
