"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/domain";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel, roleRequiresSalesPoint } from "@/lib/auth-display";

type UserRow = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  salesPointId: number | null;
  salesPoint: { id: number; name: string } | null;
};

const ROLE_OPTIONS: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
  UserRole.SENIOR_SUPERVISOR,
  UserRole.SUPERVISOR,
  UserRole.CLERK,
];

export function UsersClient(props: {
  users: UserRow[];
  salesPoints: Array<{ id: number; name: string }>;
  saveUserAction: (formData: FormData) => Promise<void> | void;
  setUserActiveAction: (formData: FormData) => Promise<void> | void;
}) {
  const { users, salesPoints, saveUserAction, setUserActiveAction } = props;
  const router = useRouter();
  const { status, session } = useAuth();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [username, setUsername] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [role, setRole] = React.useState<UserRole>(UserRole.CLERK);
  const [salesPointId, setSalesPointId] = React.useState<string>("");
  const [banner, setBanner] = React.useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = React.useState<{
    id: string;
    username: string;
  } | null>(null);

  const isAdmin = session?.role === UserRole.ADMIN;

  function reset() {
    setEditingId(null);
    setUsername("");
    setName("");
    setPassword("");
    setConfirmPassword("");
    setRole(UserRole.CLERK);
    setSalesPointId(salesPoints[0] ? String(salesPoints[0].id) : "");
    setBanner(null);
  }

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setUsername(u.username);
    setName(u.name);
    setPassword("");
    setRole(u.role);
    setSalesPointId(u.salesPointId != null ? String(u.salesPointId) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  React.useEffect(() => {
    if (salesPoints.length > 0 && !salesPointId) {
      setSalesPointId(String(salesPoints[0].id));
    }
  }, [salesPoints, salesPointId]);

  async function onSaveForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status !== "ready" || !session?.userId) {
      setBanner({ type: "error", text: "You must be signed in as an administrator." });
      return;
    }
    setBanner(null);
    if (!editingId) {
      if (password !== confirmPassword) {
        setBanner({ type: "error", text: "Password and confirmation do not match." });
        return;
      }
    } else if (password.length > 0 && password !== confirmPassword) {
      setBanner({ type: "error", text: "Password and confirmation do not match." });
      return;
    }

    const fd = new FormData(e.currentTarget);
    const wasEdit = editingId != null;
    try {
      await saveUserAction(fd);
      setBanner({ type: "ok", text: wasEdit ? "User updated." : "User created." });
      reset();
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save user.",
      });
    }
  }

  async function confirmDeactivate() {
    if (!pendingDeactivate || status !== "ready" || !session?.userId) return;
    const fd = new FormData();
    fd.set("id", pendingDeactivate.id);
    fd.set("active", "0");
    try {
      await setUserActiveAction(fd);
      setPendingDeactivate(null);
      setBanner({ type: "ok", text: "User deactivated." });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not deactivate user.",
      });
    }
  }

  if (status !== "ready") {
    return <div className="text-sm opacity-75">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
        User accounts can only be managed by an <span className="font-medium">Administrator</span>.
        Sign in as an admin user to access this page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm opacity-75">
          Create accounts with username, password, role, and (for field roles) a sales point.
          Give each person their credentials; they sign in with username and password only.
        </p>
      </div>

      {banner ? (
        <div
          className={
            banner.type === "error"
              ? "rounded-lg border border-red-600/40 bg-red-600/5 px-4 py-3 text-sm text-red-800 dark:text-red-300"
              : "rounded-lg border border-emerald-600/40 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <form onSubmit={(e) => void onSaveForm(e)} className="space-y-4 max-w-xl">
        {editingId ? <input type="hidden" name="id" value={editingId} /> : null}

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            autoComplete="off"
            required
          />
          <div className="text-xs opacity-70">Stored in lowercase; used only to sign in.</div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="name">
            Display name
          </label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            required
          />
          <div className="text-xs opacity-70">Shown on invoices and reports (e.g. full name).</div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="password">
            Password {editingId ? <span className="font-normal opacity-70">(leave blank to keep)</span> : null}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            autoComplete="new-password"
            required={!editingId}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="confirmPassword">
            Confirm password{" "}
            {editingId ? (
              <span className="font-normal opacity-70">(required if changing password)</span>
            ) : null}
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            autoComplete="new-password"
            required={!editingId || password.length > 0}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            name="role"
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            required
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </div>

        {roleRequiresSalesPoint(role) ? (
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="salesPointId">
              Sales point
            </label>
            <select
              id="salesPointId"
              name="salesPointId"
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              value={salesPointId}
              onChange={(e) => setSalesPointId(e.target.value)}
              required
            >
              {salesPoints.length === 0 ? (
                <option value="">Add a sales point first</option>
              ) : (
                salesPoints.map((sp) => (
                  <option key={sp.id} value={String(sp.id)}>
                    {sp.name}
                  </option>
                ))
              )}
            </select>
          </div>
        ) : (
          <p className="text-xs opacity-70 rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
            This role is not tied to a single sales point (organization-wide access).
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium"
          >
            {editingId != null ? "Save changes" : "Add user"}
          </button>
          {editingId != null ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">All users</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-2">Username</div>
            <div className="col-span-2">Name</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Sales point</div>
            <div className="col-span-1">Active</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          {users.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No users yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="col-span-2 font-mono text-xs truncate" title={u.username}>
                    {u.username}
                  </div>
                  <div className="col-span-2 truncate">{u.name}</div>
                  <div className="col-span-2 opacity-90">{roleLabel(u.role)}</div>
                  <div className="col-span-2 truncate text-xs opacity-80">
                    {u.salesPoint?.name ?? "—"}
                  </div>
                  <div className="col-span-1">{u.isActive ? "Yes" : "No"}</div>
                  <div className="col-span-3 flex justify-end gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => startEdit(u)}
                      className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Edit
                    </button>
                    {u.isActive ? (
                      <button
                        type="button"
                        onClick={() => setPendingDeactivate({ id: u.id, username: u.username })}
                        className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <form
                        className="inline"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!session?.userId) return;
                          const fd = new FormData();
                          fd.set("id", u.id);
                          fd.set("active", "1");
                          try {
                            await setUserActiveAction(fd);
                            setBanner({ type: "ok", text: "User reactivated." });
                            router.refresh();
                          } catch (err) {
                            setBanner({
                              type: "error",
                              text: err instanceof Error ? err.message : "Could not reactivate.",
                            });
                          }
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          Reactivate
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {pendingDeactivate ? (
        <ConfirmDialog
          title="Deactivate this user?"
          description={`“${pendingDeactivate.username}” will no longer be able to sign in.`}
          confirmLabel="Deactivate"
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={() => void confirmDeactivate()}
        />
      ) : null}
    </div>
  );
}
