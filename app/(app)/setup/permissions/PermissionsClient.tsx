"use client";

import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/lib/domain";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/access-control-keys";
import {
  getRolePermissionsAction,
  resetRolePermissions,
  setRolePermission,
} from "./actions";

const ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
  UserRole.SENIOR_SUPERVISOR,
  UserRole.SUPERVISOR,
  UserRole.CLERK,
  UserRole.CLERK_IN_CHARGE_BPO,
];

function groupForKey(key: PermissionKey): string {
  if (key.startsWith("route:/setup")) return "Setup routes";
  if (key.startsWith("route:/reports")) return "Report routes";
  if (key.startsWith("route:/")) return "App routes";
  if (key.startsWith("ui:")) return "UI controls";
  return "Other";
}

export function PermissionsClient() {
  const { status, session } = useAuth();
  const [role, setRole] = React.useState<UserRole>(UserRole.CLERK);
  const [map, setMap] = React.useState<Record<string, boolean> | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const isAdmin = session?.role === UserRole.ADMIN;

  React.useEffect(() => {
    if (status !== "ready") return;
    if (!session?.userId) return;
    if (!isAdmin) return;
    window.queueMicrotask(() => setMap(null));
    void getRolePermissionsAction(role as Parameters<typeof getRolePermissionsAction>[0]).then((m) => {
      setMap(m as unknown as Record<string, boolean>);
    });
  }, [status, session?.userId, isAdmin, role]);

  if (status !== "ready")
    return <div className="text-sm opacity-70">Loading…</div>;
  if (!session?.userId) return <div className="text-sm">Login required.</div>;
  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 text-sm">
        Only administrators can manage access control.
      </div>
    );
  }

  const keys = [...PERMISSION_KEYS] as PermissionKey[];
  const grouped = keys.reduce(
    (acc, k) => {
      const g = groupForKey(k);
      (acc[g] ??= []).push(k);
      return acc;
    },
    {} as Record<string, PermissionKey[]>,
  );

  async function toggle(key: PermissionKey, allowed: boolean) {
    if (!session?.userId) return;
    setBusyKey(key);
    try {
      const fd = new FormData();
      fd.set("role", role);
      fd.set("key", key);
      fd.set("allowed", allowed ? "1" : "0");
      await setRolePermission(fd);
      setMap((prev) => (prev ? { ...prev, [key]: allowed } : prev));
    } finally {
      setBusyKey(null);
    }
  }

  async function onReset() {
    if (!session?.userId) return;
    setBusyKey("reset");
    try {
      const fd = new FormData();
      fd.set("role", role);
      await resetRolePermissions(fd);
      const next = await getRolePermissionsAction(role as Parameters<typeof getRolePermissionsAction>[0]);
      setMap(next as unknown as Record<string, boolean>);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Role</label>
          <select
            className="h-10 rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void onReset()}
          disabled={busyKey !== null}
          className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
        >
          Reset to defaults
        </button>
      </div>

      {map == null ? (
        <div className="text-sm opacity-70">Loading permissions…</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([group, list]) => (
            <section
              key={group}
              className="rounded-lg border border-black/10 dark:border-white/10 p-4"
            >
              <div className="font-medium text-sm">{group}</div>
              <div className="mt-3 grid gap-2">
                {list.map((key) => {
                  const allowed = Boolean(map[key]);
                  return (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="font-mono text-xs">{key}</span>
                      <input
                        type="checkbox"
                        checked={allowed}
                        onChange={(e) => void toggle(key, e.target.checked)}
                        disabled={busyKey !== null && busyKey !== key}
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
