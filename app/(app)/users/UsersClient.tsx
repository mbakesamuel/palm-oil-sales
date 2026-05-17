"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/domain";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel, roleRequiresSalesPoint } from "@/lib/auth-display";

type CommercialOption = {
  id: string;
  name: string;
  invoicePrefix: string;
  isActive: boolean;
};

type UserRow = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  salesPointId: number | null;
  salesPoint: { id: number; name: string } | null;
  service: string | null;
  commercialServiceId: string | null;
  commercialService: { id: string; name: string; invoicePrefix: string } | null;
};

const ROLE_OPTIONS: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
  UserRole.SENIOR_SUPERVISOR,
  UserRole.SUPERVISOR,
  UserRole.CLERK,
  UserRole.CLERK_IN_CHARGE_BPO,
];

const inputClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm";
const selectClass = inputClass;
const labelClass = "text-xs font-medium";
const hintClass = "text-[11px] opacity-70 mt-0.5";
const fieldRowClass = "flex items-start gap-2";
const fieldLabelClass = [
  labelClass,
  "shrink-0 w-[7.25rem] h-8",
  "flex items-center justify-end px-2",
  "rounded-md border border-border",
  "bg-sidebar text-sidebar-foreground",
].join(" ");
const fieldControlClass = "min-w-0 flex-1";

export function UsersClient(props: {
  users: UserRow[];
  salesPoints: Array<{ id: number; name: string }>;
  commercialServices: CommercialOption[];
  saveUserAction: (formData: FormData) => Promise<void> | void;
  setUserActiveAction: (formData: FormData) => Promise<void> | void;
}) {
  const { users, salesPoints, commercialServices, saveUserAction, setUserActiveAction } =
    props;
  const router = useRouter();
  const { status, session, refreshSession } = useAuth();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [username, setUsername] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [role, setRole] = React.useState<UserRole | "">("");
  const [salesPointId, setSalesPointId] = React.useState<string>("");
  const [commercialServiceId, setCommercialServiceId] = React.useState<string>("");
  const [service, setService] = React.useState("");
  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = React.useState<{
    id: string;
    username: string;
  } | null>(null);

  const isAdmin = session?.role === UserRole.ADMIN;

  function resetForm(opts?: { clearBanner?: boolean }) {
    setEditingId(null);
    setUsername("");
    setName("");
    setPassword("");
    setConfirmPassword("");
    setRole("");
    setSalesPointId("");
    setCommercialServiceId("");
    setService("");
    if (opts?.clearBanner !== false) setBanner(null);
  }

  function closeForm(opts?: { clearBanner?: boolean }) {
    setIsFormOpen(false);
    resetForm(opts);
  }

  function openAddForm() {
    resetForm();
    setBanner(null);
    setIsFormOpen(true);
  }

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setUsername(u.username);
    setName(u.name);
    setPassword("");
    setConfirmPassword("");
    setRole(u.role);
    setSalesPointId(u.salesPointId != null ? String(u.salesPointId) : "");
    setCommercialServiceId(u.commercialServiceId ?? "");
    setService(u.service ?? "");
    setBanner(null);
    setIsFormOpen(true);
  }

  async function onSaveForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status !== "ready" || !session?.userId) {
      setBanner({
        type: "error",
        text: "You must be signed in as an administrator.",
      });
      return;
    }
    setBanner(null);
    if (!role) {
      setBanner({ type: "error", text: "Please select a role." });
      return;
    }
    if (roleRequiresSalesPoint(role) && !salesPointId) {
      setBanner({ type: "error", text: "Please select a sales point." });
      return;
    }
    if (!editingId) {
      if (password !== confirmPassword) {
        setBanner({
          type: "error",
          text: "Password and confirmation do not match.",
        });
        return;
      }
    } else if (password.length > 0 && password !== confirmPassword) {
      setBanner({
        type: "error",
        text: "Password and confirmation do not match.",
      });
      return;
    }

    const fd = new FormData(e.currentTarget);
    if (editingId) fd.set("id", editingId);
    const wasEdit = editingId != null;
    try {
      await saveUserAction(fd);
      closeForm({ clearBanner: false });
      const selfUpdated = editingId != null && editingId === session?.userId;
      if (selfUpdated) {
        await refreshSession();
      }
      setBanner({
        type: "ok",
        text: selfUpdated
          ? "Your profile was updated."
          : wasEdit
            ? "User updated."
            : "User created.",
      });
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
        User accounts can only be managed by an{" "}
        <span className="font-medium">Administrator</span>. Sign in as an admin
        user to access this page.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm opacity-75">
          Create accounts with username, password, role, and (for field roles) a
          sales point. Give each person their credentials; they sign in with
          username and password only.
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

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Edit user" : "Add user"}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeForm();
          }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => closeForm()}
          />

          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background text-foreground p-3 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold">
                {editingId ? "Edit user" : "Add user"}
              </div>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 text-xs"
                onClick={() => closeForm()}
              >
                X
              </button>
            </div>

            <form
              onSubmit={(e) => void onSaveForm(e)}
              className="mt-3 space-y-1.5 max-h-[min(28rem,calc(100vh-6rem))] overflow-y-auto pr-1"
            >
              {editingId ? (
                <input type="hidden" name="id" value={editingId} />
              ) : null}

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="username">
                  Username
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="username"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClass}
                    autoComplete="off"
                    required
                  />
                  <p className={hintClass}>Stored in lowercase; used to sign in.</p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="name">
                  Name
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    required
                  />
                  <p className={hintClass}>
                    Shown on invoices and reports.
                  </p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="commercialServiceId">
                  Line
                </label>
                <div className={fieldControlClass}>
                  <select
                    id="commercialServiceId"
                    name="commercialServiceId"
                    className={selectClass}
                    value={commercialServiceId}
                    onChange={(e) => setCommercialServiceId(e.target.value)}
                  >
                    <option value="">Default (company fallback)</option>
                    {commercialServices.map((s) => (
                      <option key={s.id} value={s.id} disabled={!s.isActive}>
                        {s.name}
                        {!s.isActive ? " (inactive)" : ""} · {s.invoicePrefix}
                      </option>
                    ))}
                  </select>
                  <p className={hintClass}>
                    Invoice prefix and letterhead for this user&apos;s sales.
                  </p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="service">
                  Service note
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="service"
                    name="service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className={inputClass}
                    placeholder="Optional"
                  />
                  <p className={hintClass}>
                    Extra label in the shell after sign-in.
                  </p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="password">
                  Password
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    required={!editingId}
                  />
                  {editingId ? (
                    <p className={hintClass}>Leave blank to keep current password.</p>
                  ) : null}
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="confirmPassword">
                  Confirm
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    required={!editingId || password.length > 0}
                  />
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="role">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  className={`${selectClass} ${fieldControlClass}`}
                  value={role}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRole(v === "" ? "" : (v as UserRole));
                    if (!roleRequiresSalesPoint(v as UserRole)) {
                      setSalesPointId("");
                    }
                  }}
                  required
                >
                  <option value="">Select role…</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="salesPointId">
                  Sales point
                </label>
                {role !== "" && roleRequiresSalesPoint(role) ? (
                  <select
                    id="salesPointId"
                    name="salesPointId"
                    className={`${selectClass} ${fieldControlClass}`}
                    value={salesPointId}
                    onChange={(e) => setSalesPointId(e.target.value)}
                    required
                  >
                    {salesPoints.length === 0 ? (
                      <option value="">Add a sales point first</option>
                    ) : (
                      <>
                        <option value="">Select sales point…</option>
                        {salesPoints.map((sp) => (
                          <option key={sp.id} value={String(sp.id)}>
                            {sp.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                ) : (
                  <p className={`${fieldControlClass} text-xs opacity-70 py-1.5`}>
                    Organization-wide access (no single sales point).
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
                >
                  {editingId ? "Save changes" : "Add user"}
                </button>
                <button
                  type="button"
                  onClick={() => closeForm()}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold">All users</h2>
          <button
            type="button"
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
            onClick={openAddForm}
          >
            Add user
          </button>
        </div>
        {users.length === 0 ? (
          <p className="text-sm opacity-75">No users yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">Username</th>
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Role</th>
                  <th className="p-2 font-medium">Sales point</th>
                  <th className="p-2 font-medium">Line</th>
                  <th className="p-2 font-medium w-20">Active</th>
                  <th className="p-2 font-medium w-36 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={[
                      "border-b border-border align-top",
                      editingId === u.id ? "bg-accent/15" : "",
                    ].join(" ")}
                  >
                    <td
                      className="p-2 font-mono text-xs"
                      title={u.username}
                    >
                      {u.username}
                    </td>
                    <td className="p-2 font-medium">{u.name}</td>
                    <td className="p-2 opacity-90">{roleLabel(u.role)}</td>
                    <td className="p-2 text-xs opacity-80">
                      {u.salesPoint?.name ?? "—"}
                    </td>
                    <td
                      className="p-2 text-xs opacity-80 max-w-[8rem] truncate"
                      title={
                        u.commercialService?.name
                          ? `${u.commercialService.name} (${u.commercialService.invoicePrefix})`
                          : (u.service ?? "")
                      }
                    >
                      {u.commercialService?.name ??
                        (u.service?.trim() ? u.service : "—")}
                    </td>
                    <td className="p-2">
                      {u.isActive ? (
                        <span className="inline-flex rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-border bg-accent/10 px-2 py-0.5 text-xs opacity-80">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                        >
                          Edit
                        </button>
                        {u.isActive ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingDeactivate({
                                id: u.id,
                                username: u.username,
                              })
                            }
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
                                setBanner({
                                  type: "ok",
                                  text: "User reactivated.",
                                });
                                router.refresh();
                              } catch (err) {
                                setBanner({
                                  type: "error",
                                  text:
                                    err instanceof Error
                                      ? err.message
                                      : "Could not reactivate.",
                                });
                              }
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                            >
                              Reactivate
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
