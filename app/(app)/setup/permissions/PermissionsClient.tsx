"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/lib/domain";
import { PERMISSION_KEYS, permissionLabelForKey, type PermissionKey } from "@/lib/access-control-keys";
import {
  type CommercialModuleKey,
  permissionKeysForModules,
} from "@/lib/commercial-modules";
import {
  getGlobalRolePermissionsAction,
  getServiceRolePermissionsAction,
  resetGlobalRolePermissions,
  resetServiceRolePermissions,
  setGlobalRolePermission,
  setServiceRolePermission,
  type GlobalRolesCatalog,
  type LinePermissionsCatalog,
} from "./actions";
import { GlobalRoleDefinitions } from "./GlobalRoleDefinitions";
import { LineRoleDefinitions } from "./LineRoleDefinitions";

type Scope = "global" | "line";

function groupForKey(key: PermissionKey): string {
  if (key.startsWith("route:/setup")) return "Setup routes";
  if (key.startsWith("route:/reports")) return "Report routes";
  if (key.startsWith("route:/")) return "App routes";
  if (key.startsWith("ui:")) return "UI controls";
  return "Other";
}

function filterKeysForLine(
  keys: PermissionKey[],
  enabledModules: readonly string[],
): PermissionKey[] {
  const allowedRoutes = permissionKeysForModules(
    enabledModules as CommercialModuleKey[],
  );
  return keys.filter((k) => !k.startsWith("route:") || allowedRoutes.has(k));
}

function PermissionMatrix(props: {
  keys: PermissionKey[];
  map: Record<string, boolean> | null;
  busyKey: string | null;
  onToggle: (key: PermissionKey, allowed: boolean) => void;
}) {
  const { keys, map, busyKey, onToggle } = props;
  const grouped = keys.reduce(
    (acc, k) => {
      const g = groupForKey(k);
      (acc[g] ??= []).push(k);
      return acc;
    },
    {} as Record<string, PermissionKey[]>,
  );

  if (map == null) {
    return <div className="text-sm opacity-70">Loading permissions…</div>;
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([group, list]) => (
        <section key={group} className="rounded-lg border border-border p-4">
          <div className="font-medium text-sm">{group}</div>
          <div className="mt-3 grid gap-2">
            {list.map((key) => {
              const allowed = Boolean(map[key]);
              return (
                <label
                  key={key}
                  className="flex w-full cursor-pointer items-start gap-2 text-sm"
                >
                  <span className="min-w-0 flex-1 break-all font-mono text-xs leading-6">
                    {permissionLabelForKey(key)}
                    {permissionLabelForKey(key) !== key ? (
                      <span className="mt-0.5 block font-sans text-[11px] opacity-60">{key}</span>
                    ) : null}
                  </span>
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={allowed}
                      onChange={(e) => void onToggle(key, e.target.checked)}
                      disabled={busyKey !== null && busyKey !== key}
                      className="m-0 size-5 shrink-0 cursor-pointer rounded border-border accent-brand disabled:cursor-not-allowed"
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export type PermissionsLoadErrors = {
  global?: string;
  line?: string;
};

export function PermissionsClient(props: {
  globalCatalog: GlobalRolesCatalog;
  lineCatalog: LinePermissionsCatalog;
  loadErrors?: PermissionsLoadErrors;
}) {
  const { globalCatalog, lineCatalog, loadErrors } = props;
  const { status, session } = useAuth();
  const [scope, setScope] = React.useState<Scope>("global");
  const [globalRoleId, setGlobalRoleId] = React.useState("");
  const [commercialServiceId, setCommercialServiceId] = React.useState("");
  const [serviceRoleId, setServiceRoleId] = React.useState("");
  const [map, setMap] = React.useState<Record<string, boolean> | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const isAdmin = session?.role === UserRole.ADMIN;

  const selectedService = lineCatalog.services.find(
    (s) => s.id === commercialServiceId,
  );
  const rolesForLine = React.useMemo(
    () =>
      lineCatalog.roles.filter(
        (r) => r.commercialServiceId === commercialServiceId && r.isActive,
      ),
    [lineCatalog.roles, commercialServiceId],
  );

  const selectedGlobalRole = globalCatalog.roles.find((r) => r.id === globalRoleId);
  const activeGlobalRoles = React.useMemo(
    () => globalCatalog.roles.filter((r) => r.isActive),
    [globalCatalog.roles],
  );

  const visibleKeys = React.useMemo(() => {
    const all = [...PERMISSION_KEYS] as PermissionKey[];
    if (scope === "global") return all;
    if (!selectedService) return [];
    return filterKeysForLine(all, selectedService.enabledModules);
  }, [scope, selectedService]);

  React.useEffect(() => {
    if (status !== "ready" || !session?.userId || !isAdmin) return;
    if (scope === "global") {
      if (!globalRoleId) {
        setMap(null);
        return;
      }
      setMap(null);
      void getGlobalRolePermissionsAction(globalRoleId)
        .then((m) => {
          setMap(m as unknown as Record<string, boolean>);
        })
        .catch(() => setMap(null));
      return;
    }
    if (!serviceRoleId) {
      setMap(null);
      return;
    }
    setMap(null);
    void getServiceRolePermissionsAction(serviceRoleId)
      .then((m) => {
        setMap(m as unknown as Record<string, boolean>);
      })
      .catch(() => setMap(null));
  }, [status, session?.userId, isAdmin, scope, globalRoleId, serviceRoleId]);

  React.useEffect(() => {
    if (scope !== "global" || activeGlobalRoles.length === 0) return;
    setGlobalRoleId((current) => {
      if (current && activeGlobalRoles.some((r) => r.id === current)) return current;
      return activeGlobalRoles[0]?.id ?? "";
    });
  }, [scope, activeGlobalRoles]);

  React.useEffect(() => {
    if (scope !== "line") return;
    const firstRoleId = rolesForLine[0]?.id ?? "";
    setServiceRoleId((current) => {
      if (current && rolesForLine.some((r) => r.id === current)) return current;
      return firstRoleId;
    });
  }, [scope, commercialServiceId, rolesForLine]);

  React.useEffect(() => {
    if (scope !== "line" || lineCatalog.services.length === 0) return;
    const firstServiceId = lineCatalog.services[0]?.id ?? "";
    setCommercialServiceId((current) => {
      if (current && lineCatalog.services.some((s) => s.id === current))
        return current;
      return firstServiceId;
    });
  }, [scope, lineCatalog.services]);

  if (status !== "ready") {
    return <div className="text-sm opacity-70">Loading…</div>;
  }
  if (!session?.userId) return <div className="text-sm">Login required.</div>;
  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm">
        Only administrators can manage access control.
      </div>
    );
  }

  async function toggleGlobal(key: PermissionKey, allowed: boolean) {
    if (!globalRoleId) return;
    setBusyKey(key);
    try {
      const fd = new FormData();
      fd.set("globalRoleId", globalRoleId);
      fd.set("key", key);
      fd.set("allowed", allowed ? "1" : "0");
      await setGlobalRolePermission(fd);
      setMap((prev) => (prev ? { ...prev, [key]: allowed } : prev));
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleLine(key: PermissionKey, allowed: boolean) {
    if (!serviceRoleId) return;
    setBusyKey(key);
    try {
      const fd = new FormData();
      fd.set("serviceRoleId", serviceRoleId);
      fd.set("key", key);
      fd.set("allowed", allowed ? "1" : "0");
      await setServiceRolePermission(fd);
      setMap((prev) => (prev ? { ...prev, [key]: allowed } : prev));
    } finally {
      setBusyKey(null);
    }
  }

  async function onReset() {
    setBusyKey("reset");
    try {
      if (scope === "global" && globalRoleId) {
        const fd = new FormData();
        fd.set("globalRoleId", globalRoleId);
        await resetGlobalRolePermissions(fd);
        const next = await getGlobalRolePermissionsAction(globalRoleId);
        setMap(next as unknown as Record<string, boolean>);
      } else if (serviceRoleId) {
        const fd = new FormData();
        fd.set("serviceRoleId", serviceRoleId);
        await resetServiceRolePermissions(fd);
        const next = await getServiceRolePermissionsAction(serviceRoleId);
        setMap(next as unknown as Record<string, boolean>);
      }
    } finally {
      setBusyKey(null);
    }
  }

  const canResetGlobal = scope === "global" && Boolean(globalRoleId);
  const canResetLine = scope === "line" && Boolean(serviceRoleId);

  const hasLoadErrors = Boolean(loadErrors?.global || loadErrors?.line);

  return (
    <div className="space-y-4">
      {hasLoadErrors ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm space-y-2">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Some role data could not be loaded
          </p>
          {loadErrors?.global ? (
            <p>
              <span className="font-medium">Global roles:</span> {loadErrors.global}
            </p>
          ) : null}
          {loadErrors?.line ? (
            <p>
              <span className="font-medium">Line roles:</span> {loadErrors.line}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setScope("global")}
          className={[
            "rounded-md border px-3 py-1.5 text-sm",
            scope === "global"
              ? "border-brand bg-brand/10 font-medium"
              : "border-border",
          ].join(" ")}
        >
          Global roles
        </button>
        <button
          type="button"
          onClick={() => setScope("line")}
          className={[
            "rounded-md border px-3 py-1.5 text-sm",
            scope === "line"
              ? "border-brand bg-brand/10 font-medium"
              : "border-border",
          ].join(" ")}
        >
          Line roles
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {scope === "line" ? (
          <div className="flex flex-wrap gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Service</label>
              <select
                className="h-10 rounded-md border border-border bg-transparent px-3 py-2 text-sm min-w-48"
                value={commercialServiceId}
                onChange={(e) => {
                  setCommercialServiceId(e.target.value);
                  setServiceRoleId("");
                }}
              >
                {lineCatalog.services.length === 0 ? (
                  <option value="">No lines configured</option>
                ) : (
                  lineCatalog.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (
                      {s.siteKind === "FACTORY" ? "factory" : "sales points"})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Line role</label>
              <select
                className="h-10 rounded-md border border-border bg-transparent px-3 py-2 text-sm min-w-48"
                value={serviceRoleId}
                onChange={(e) => setServiceRoleId(e.target.value)}
                disabled={rolesForLine.length === 0}
              >
                {rolesForLine.length === 0 ? (
                  <option value="">
                    No roles — save the line under Services first
                  </option>
                ) : (
                  rolesForLine.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            {selectedService ? (
              <p className="text-xs opacity-70 max-w-md self-end pb-2">
                Showing routes enabled for:{" "}
                {selectedService.enabledModules.join(", ") || "no modules"}
              </p>
            ) : null}
          </div>
        ) : selectedGlobalRole ? (
          <p className="text-xs opacity-70 max-w-md pb-2">
            Editing permissions for{" "}
            <span className="font-medium">{selectedGlobalRole.displayName}</span> (
            {selectedGlobalRole.code})
          </p>
        ) : (
          <p className="text-xs opacity-70 max-w-md pb-2">
            Select a global role below to edit route permissions.
          </p>
        )}
        <button
          type="button"
          onClick={() => void onReset()}
          disabled={busyKey !== null || (!canResetGlobal && !canResetLine)}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/25 disabled:opacity-50"
        >
          Reset to defaults
        </button>
      </div>

      {scope === "global" ? (
        <GlobalRoleDefinitions
          roles={globalCatalog.roles}
          selectedRoleId={globalRoleId}
          onSelectRole={setGlobalRoleId}
        />
      ) : null}

      {scope === "line" && commercialServiceId ? (
        <LineRoleDefinitions
          commercialServiceId={commercialServiceId}
          roles={lineCatalog.roles}
          selectedRoleId={serviceRoleId}
          onSelectRole={setServiceRoleId}
        />
      ) : null}

      {scope === "line" && lineCatalog.services.length === 0 ? (
        <p className="text-sm opacity-75">
          Add a commercial line under Setup → Services, then assign line roles
          under Users.
        </p>
      ) : scope === "line" && !serviceRoleId ? (
        <p className="text-sm opacity-75">
          Select or create a line role above to edit its route permissions.
        </p>
      ) : scope === "line" ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Route permissions</h2>
          <PermissionMatrix
            keys={visibleKeys}
            map={map}
            busyKey={busyKey}
            onToggle={(key, allowed) => void toggleLine(key, allowed)}
          />
        </div>
      ) : globalRoleId ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Route permissions</h2>
          <PermissionMatrix
            keys={visibleKeys}
            map={map}
            busyKey={busyKey}
            onToggle={(key, allowed) => void toggleGlobal(key, allowed)}
          />
        </div>
      ) : (
        <p className="text-sm opacity-75">Select a global role to edit permissions.</p>
      )}
    </div>
  );
}

