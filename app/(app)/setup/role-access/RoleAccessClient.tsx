"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/lib/domain";
import {
  ROLE_ACCESS_GROUPS,
  groupStateForPermissions,
} from "@/lib/role-access-groups";
import {
  permissionKeysForModules,
  type CommercialModuleKey,
} from "@/lib/commercial-modules";
import type { PermissionKey } from "@/lib/access-control-keys";
import type { GlobalRolesCatalog, LinePermissionsCatalog } from "@/app/(app)/setup/permissions/actions";
import {
  getRoleAccessPermissionsAction,
  setRoleAccessGroup,
  type RoleAccessScope,
} from "./actions";

const checkboxClass =
  "m-0 size-5 shrink-0 cursor-pointer rounded border-border accent-brand disabled:cursor-not-allowed";

export function RoleAccessClient(props: {
  globalCatalog: GlobalRolesCatalog;
  lineCatalog: LinePermissionsCatalog;
  loadErrors: { global?: string; line?: string };
}) {
  const { globalCatalog, lineCatalog, loadErrors } = props;
  const { session } = useAuth();
  const isAdmin = session?.role === UserRole.ADMIN;

  const [scope, setScope] = React.useState<RoleAccessScope>("global");
  const [selectedGlobalId, setSelectedGlobalId] = React.useState(
    () => globalCatalog.roles.find((r) => r.isActive)?.id ?? "",
  );
  const [selectedLineId, setSelectedLineId] = React.useState(
    () => lineCatalog.services[0]?.id ?? "",
  );
  const [selectedLineRoleId, setSelectedLineRoleId] = React.useState("");

  const lineRolesForService = React.useMemo(
    () =>
      lineCatalog.roles.filter(
        (r) => r.commercialServiceId === selectedLineId && r.isActive,
      ),
    [lineCatalog.roles, selectedLineId],
  );

  React.useEffect(() => {
    if (!selectedLineRoleId && lineRolesForService[0]) {
      setSelectedLineRoleId(lineRolesForService[0].id);
    }
  }, [lineRolesForService, selectedLineRoleId]);

  const selectedLineService = lineCatalog.services.find((s) => s.id === selectedLineId);
  const routeFilter =
    scope === "line" && selectedLineService
      ? permissionKeysForModules(
          selectedLineService.enabledModules as CommercialModuleKey[],
        )
      : null;

  const activeRoleId = scope === "global" ? selectedGlobalId : selectedLineRoleId;

  const [permMap, setPermMap] = React.useState<Record<string, boolean> | null>(null);
  const [busyGroup, setBusyGroup] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<{ type: "error" | "ok"; text: string } | null>(
    null,
  );

  React.useEffect(() => {
    if (!activeRoleId) {
      setPermMap(null);
      return;
    }
    let cancelled = false;
    setPermMap(null);
    void getRoleAccessPermissionsAction(scope, activeRoleId)
      .then((m) => {
        if (!cancelled) setPermMap(m as Record<string, boolean>);
      })
      .catch((e) => {
        if (!cancelled) {
          setBanner({
            type: "error",
            text: e instanceof Error ? e.message : "Could not load permissions.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scope, activeRoleId]);

  async function onToggleGroup(groupId: string, next: boolean) {
    if (!activeRoleId) return;
    setBanner(null);
    setBusyGroup(groupId);
    try {
      await setRoleAccessGroup(
        scope,
        activeRoleId,
        groupId,
        next,
        scope === "line" ? selectedLineService?.enabledModules : undefined,
      );
      const fresh = await getRoleAccessPermissionsAction(scope, activeRoleId);
      setPermMap(fresh as Record<string, boolean>);
      setBanner({ type: "ok", text: "Access updated." });
    } catch (e) {
      setBanner({
        type: "error",
        text: e instanceof Error ? e.message : "Could not update access.",
      });
    } finally {
      setBusyGroup(null);
    }
  }

  if (!isAdmin) {
    return (
      <p className="text-sm opacity-75">
        Only administrators can configure role access.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {loadErrors.global ? (
        <p className="text-sm text-destructive">{loadErrors.global}</p>
      ) : null}
      {loadErrors.line ? (
        <p className="text-sm text-destructive">{loadErrors.line}</p>
      ) : null}
      {banner ? (
        <p
          className={[
            "text-sm rounded-md border px-3 py-2",
            banner.type === "error"
              ? "border-destructive/40 text-destructive"
              : "border-brand/30 text-foreground",
          ].join(" ")}
        >
          {banner.text}
        </p>
      ) : null}

      <p className="text-sm opacity-75">
        Toggle capability groups per role. Changes are stored in the database and
        apply to web and mobile. For individual permission keys, use{" "}
        <Link href="/setup/permissions" className="text-brand underline">
          User access control
        </Link>
        .
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setScope("global")}
          className={[
            "rounded-md border px-3 py-1.5 text-sm",
            scope === "global" ? "border-brand bg-brand/10" : "border-border",
          ].join(" ")}
        >
          Global roles
        </button>
        <button
          type="button"
          onClick={() => setScope("line")}
          className={[
            "rounded-md border px-3 py-1.5 text-sm",
            scope === "line" ? "border-brand bg-brand/10" : "border-border",
          ].join(" ")}
        >
          Line roles
        </button>
      </div>

      {scope === "global" ? (
        <label className="flex flex-col gap-1 text-sm max-w-md">
          <span className="font-medium">Global role</span>
          <select
            className="rounded-md border border-border bg-transparent px-2 py-1.5"
            value={selectedGlobalId}
            onChange={(e) => setSelectedGlobalId(e.target.value)}
          >
            {globalCatalog.roles
              .filter((r) => r.isActive)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName} ({r.code})
                </option>
              ))}
          </select>
        </label>
      ) : (
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm min-w-[12rem]">
            <span className="font-medium">Commercial line</span>
            <select
              className="rounded-md border border-border bg-transparent px-2 py-1.5"
              value={selectedLineId}
              onChange={(e) => {
                setSelectedLineId(e.target.value);
                setSelectedLineRoleId("");
              }}
            >
              {lineCatalog.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm min-w-[12rem]">
            <span className="font-medium">Line role</span>
            <select
              className="rounded-md border border-border bg-transparent px-2 py-1.5"
              value={selectedLineRoleId}
              onChange={(e) => setSelectedLineRoleId(e.target.value)}
            >
              {lineRolesForService.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="space-y-3">
        {ROLE_ACCESS_GROUPS.map((group) => {
          const state = groupStateForPermissions(
            permMap,
            group.id,
            routeFilter as ReadonlySet<PermissionKey> | null,
          );
          const busy = busyGroup === group.id;
          const checked = state === "on";

          return (
            <section
              key={group.id}
              className="rounded-lg border border-border p-4"
              aria-busy={busy}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                {busy ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-brand mt-0.5" />
                ) : (
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={checked}
                    ref={(el) => {
                      if (el) el.indeterminate = state === "mixed";
                    }}
                    disabled={busy || state === "loading" || !activeRoleId}
                    onChange={(e) => void onToggleGroup(group.id, e.target.checked)}
                  />
                )}
                <span className="min-w-0">
                  <span className="font-medium text-sm block">{group.label}</span>
                  <span className="text-xs opacity-70 block mt-0.5">
                    {group.description}
                  </span>
                </span>
              </label>
            </section>
          );
        })}
      </div>
    </div>
  );
}
