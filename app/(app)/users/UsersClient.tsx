"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/domain";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { userRoleFromLineRoleCode } from "@/lib/line-role-user-role";

type CommercialOption = {
  id: string;
  name: string;
  invoicePrefix: string;
  isActive: boolean;
  siteKind: "SALES_POINT" | "FACTORY";
};

type ServiceRoleOption = {
  id: string;
  code: string;
  name: string;
  commercialServiceId: string;
  requiresFixedPostingSite: boolean;
};

type UserRow = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  globalRoleDefinitionId: string | null;
  globalRoleDefinition: { id: string; displayName: string } | null;
  isActive: boolean;
  salesPointId: number | null;
  salesPoint: { id: number; name: string } | null;
  factoryId: string | null;
  factory: { id: string; name: string } | null;
  commercialServiceId: string | null;
  commercialServiceRoleId: string | null;
  commercialService: {
    id: string;
    name: string;
    invoicePrefix: string;
    siteKind: "SALES_POINT" | "FACTORY";
  } | null;
  commercialServiceRole: { id: string; code: string; name: string } | null;
};

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

function globalRoleOptionValue(id: string) {
  return `global:${id}`;
}

function lineRoleOptionValue(id: string) {
  return `line:${id}`;
}

export function UsersClient(props: {
  users: UserRow[];
  salesPoints: Array<{ id: number; name: string }>;
  factories: Array<{ id: string; name: string; commercialServiceId: string }>;
  commercialServices: CommercialOption[];
  serviceRoles: ServiceRoleOption[];
  globalRoles: Array<{
    id: string;
    code: string;
    displayName: string;
    legacyRole: UserRole | null;
  }>;
  saveUserAction: (formData: FormData) => Promise<void> | void;
  setUserActiveAction: (formData: FormData) => Promise<void> | void;
}) {
  const {
    users,
    salesPoints,
    factories,
    commercialServices,
    serviceRoles,
    globalRoles,
    saveUserAction,
    setUserActiveAction,
  } = props;
  const router = useRouter();
  const { status, session, refreshSession } = useAuth();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [username, setUsername] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [role, setRole] = React.useState<UserRole | "">("");
  const [globalRoleDefinitionId, setGlobalRoleDefinitionId] = React.useState("");
  const [roleSelect, setRoleSelect] = React.useState("");
  const [salesPointId, setSalesPointId] = React.useState<string>("");
  const [commercialServiceId, setCommercialServiceId] = React.useState<string>("");
  const [commercialServiceRoleId, setCommercialServiceRoleId] = React.useState<string>("");
  const [factoryId, setFactoryId] = React.useState<string>("");
  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = React.useState<{
    id: string;
    username: string;
  } | null>(null);

  const isAdmin = session?.role === UserRole.ADMIN;

  const userRoleLabelForUser = React.useCallback(
    (u: UserRow) => {
      if (u.commercialServiceRole?.name) return u.commercialServiceRole.name;
      if (u.globalRoleDefinition?.displayName) return u.globalRoleDefinition.displayName;
      const g = globalRoles.find((gr) => gr.legacyRole === u.role);
      return g?.displayName ?? u.role;
    },
    [globalRoles],
  );

  const isLineStaffAccount = Boolean(commercialServiceId);

  const selectedLineRole = serviceRoles.find((r) => r.id === commercialServiceRoleId) ?? null;
  const requiresFixedPostingSiteForForm = isLineStaffAccount
    ? (selectedLineRole?.requiresFixedPostingSite ?? true)
    : false;

  function applyRoleSelect(value: string) {
    setRoleSelect(value);
    if (value.startsWith("global:")) {
      const id = value.slice("global:".length);
      const g = globalRoles.find((gr) => gr.id === id);
      setGlobalRoleDefinitionId(id);
      setCommercialServiceRoleId("");
      setRole((g?.legacyRole ?? UserRole.DIRECTOR) as UserRole);
      setSalesPointId("");
      setFactoryId("");
      return;
    }
    if (value.startsWith("line:")) {
      const id = value.slice("line:".length);
      const lineRole = serviceRoles.find((r) => r.id === id);
      setGlobalRoleDefinitionId("");
      setCommercialServiceRoleId(id);
      setRole(
        lineRole ? userRoleFromLineRoleCode(lineRole.code) : ("" as UserRole),
      );
      if (lineRole && !lineRole.requiresFixedPostingSite) {
        setSalesPointId("");
      }
    }
  }

  const selectedLine = commercialServices.find((s) => s.id === commercialServiceId);
  const lineSiteKind = selectedLine?.siteKind ?? "SALES_POINT";
  const rolesForLine = serviceRoles.filter(
    (r) => r.commercialServiceId === commercialServiceId,
  );
  const factoriesForLine = factories.filter((f) => f.commercialServiceId === commercialServiceId);

  function resetForm(opts?: { clearBanner?: boolean }) {
    setEditingId(null);
    setUsername("");
    setName("");
    setPassword("");
    setConfirmPassword("");
    setRole("");
    setGlobalRoleDefinitionId("");
    setRoleSelect("");
    setSalesPointId("");
    setCommercialServiceId("");
    setCommercialServiceRoleId("");
    setFactoryId("");
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
    setCommercialServiceId(u.commercialServiceId ?? "");
    setCommercialServiceRoleId(u.commercialServiceRoleId ?? "");
    if (u.globalRoleDefinitionId) {
      setGlobalRoleDefinitionId(u.globalRoleDefinitionId);
      setRoleSelect(globalRoleOptionValue(u.globalRoleDefinitionId));
      const g = globalRoles.find((gr) => gr.id === u.globalRoleDefinitionId);
      setRole((g?.legacyRole ?? u.role) as UserRole);
    } else if (u.commercialServiceRoleId) {
      setGlobalRoleDefinitionId("");
      setRoleSelect(lineRoleOptionValue(u.commercialServiceRoleId));
      const lineRole = serviceRoles.find((r) => r.id === u.commercialServiceRoleId);
      setRole(
        lineRole ? userRoleFromLineRoleCode(lineRole.code) : (u.role as UserRole),
      );
    } else {
      setGlobalRoleDefinitionId("");
      setRoleSelect("");
      setRole("");
    }
    setSalesPointId(u.salesPointId != null ? String(u.salesPointId) : "");
    setFactoryId(u.factoryId ?? "");
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
    if (isLineStaffAccount) {
      if (!commercialServiceRoleId) {
        setBanner({ type: "error", text: "Please select a role for this line." });
        return;
      }
      const lineRole = serviceRoles.find((r) => r.id === commercialServiceRoleId);
      const derivedRole = lineRole
        ? userRoleFromLineRoleCode(lineRole.code)
        : null;
      if (!derivedRole) {
        setBanner({ type: "error", text: "Please select a role." });
        return;
      }
      if (lineSiteKind === "FACTORY" && requiresFixedPostingSiteForForm && !factoryId) {
        setBanner({ type: "error", text: "Please select a factory." });
        return;
      }
      if (
        lineSiteKind === "SALES_POINT" &&
        requiresFixedPostingSiteForForm &&
        !salesPointId
      ) {
        setBanner({ type: "error", text: "Please select a sales point." });
        return;
      }
    } else {
      if (!globalRoleDefinitionId) {
        setBanner({ type: "error", text: "Please select an org-wide role." });
        return;
      }
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
                    onChange={(e) => {
                      setCommercialServiceId(e.target.value);
                      setCommercialServiceRoleId("");
                      setRoleSelect("");
                      setRole("");
                      setGlobalRoleDefinitionId("");
                      setFactoryId("");
                      setSalesPointId("");
                    }}
                  >
                    <option value="">None (org-wide role)</option>
                    {commercialServices.map((s) => (
                      <option key={s.id} value={s.id} disabled={!s.isActive}>
                        {s.name}
                        {!s.isActive ? " (inactive)" : ""} · {s.invoicePrefix}
                      </option>
                    ))}
                  </select>
                  <p className={hintClass}>
                    Pick a line for operational staff, or leave as none for org-wide
                    access.
                  </p>
                </div>
              </div>

              <input
                type="hidden"
                name="globalRoleDefinitionId"
                value={globalRoleDefinitionId}
              />
              <input
                type="hidden"
                name="commercialServiceRoleId"
                value={commercialServiceRoleId}
              />

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="roleSelect">
                  Role
                </label>
                <div className={fieldControlClass}>
                  <select
                    id="roleSelect"
                    className={selectClass}
                    value={roleSelect}
                    onChange={(e) => applyRoleSelect(e.target.value)}
                    required
                  >
                    <option value="">Select role…</option>
                    {isLineStaffAccount
                      ? rolesForLine.length === 0 ? (
                          <option value="" disabled>
                            No roles for this line — add roles in Setup
                          </option>
                        ) : (
                          rolesForLine.map((r) => (
                            <option key={r.id} value={lineRoleOptionValue(r.id)}>
                              {r.name}
                            </option>
                          ))
                        )
                      : globalRoles.map((r) => (
                          <option key={r.id} value={globalRoleOptionValue(r.id)}>
                            {r.displayName}
                          </option>
                        ))}
                  </select>
                  <p className={hintClass}>
                    {isLineStaffAccount
                      ? "Permissions come from the line role in Setup → Permissions."
                      : "Org-wide access (Admin, Director, or custom)."}
                  </p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label
                  className={fieldLabelClass}
                  htmlFor={
                    isLineStaffAccount && lineSiteKind === "FACTORY"
                      ? "factoryId"
                      : "salesPointId"
                  }
                >
                  {isLineStaffAccount && lineSiteKind === "FACTORY"
                    ? "Factory"
                    : "Sales point"}
                </label>
                {isLineStaffAccount && lineSiteKind === "FACTORY" ? (
                  <select
                    id="factoryId"
                    name="factoryId"
                    className={`${selectClass} ${fieldControlClass}`}
                    value={factoryId}
                    onChange={(e) => setFactoryId(e.target.value)}
                    required
                  >
                    {factoriesForLine.length === 0 ? (
                      <option value="">Add a factory first</option>
                    ) : (
                      <>
                        <option value="">Select factory…</option>
                        {factoriesForLine.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                ) : isLineStaffAccount &&
                  lineSiteKind === "SALES_POINT" &&
                  requiresFixedPostingSiteForForm ? (
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
                    {isLineStaffAccount
                      ? "No fixed sales point for this role (roams across sites)."
                      : "Organization-wide access (no single posting site)."}
                  </p>
                )}
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
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2 font-medium">Username</th>
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Role</th>
                <th className="p-2 font-medium">Site</th>
                <th className="p-2 font-medium">Line</th>
                <th className="p-2 font-medium w-20">Active</th>
                <th className="p-2 font-medium w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-foreground/70">
                    No users yet. Use{" "}
                    <span className="font-medium text-foreground">Add user</span> to
                    create one.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
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
                    <td className="p-2 opacity-90">{userRoleLabelForUser(u)}</td>
                    <td className="p-2 text-xs opacity-80">
                      {u.factory?.name ?? u.salesPoint?.name ?? "—"}
                    </td>
                    <td
                      className="p-2 text-xs opacity-80 max-w-[8rem] truncate"
                      title={
                        u.commercialService?.name
                          ? `${u.commercialService.name} (${u.commercialService.invoicePrefix})`
                          : undefined
                      }
                    >
                      {u.commercialService?.name ?? "—"}
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
                    <td className="p-2 text-right whitespace-nowrap">
                      <div className="flex justify-end items-center gap-2">
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
                ))
              )}
            </tbody>
          </table>
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

