"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/lib/domain";
import { PERMISSION_KEYS, permissionLabelForKey, type PermissionKey } from "@/lib/access-control-keys";
import {
  type CommercialModuleKey,
  permissionKeysForModules,
} from "@/lib/commercial-modules";
import {
  getGlobalRolePermissionsAction,
  getGlobalRolesPermissionsBatchAction,
  getLineRolesPermissionsBatchAction,
  getServiceRolePermissionsAction,
  resetGlobalRolePermissions,
  resetServiceRolePermissions,
  setGlobalRolePermission,
  setRoleAccessGroup,
  setServiceRolePermission,
  type GlobalRolesCatalog,
  type LinePermissionsCatalog,
} from "./actions";
import { CapabilityGroupsPanel } from "./CapabilityGroupsPanel";
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

const permissionCheckboxClass =
  "m-0 size-5 shrink-0 cursor-pointer rounded border-border accent-brand disabled:cursor-not-allowed";

function groupBusyId(group: string): string {
  return `group:${group}`;
}

type GroupSaveProgress = {
  group: string;
  done: number;
  total: number;
};

function PermissionMatrix(props: {
  keys: PermissionKey[];
  map: Record<string, boolean> | null;
  busyKey: string | null;
  groupSaveProgress: GroupSaveProgress | null;
  onToggle: (key: PermissionKey, allowed: boolean) => void;
  onToggleGroup: (keys: PermissionKey[], allowed: boolean) => void;
}) {
  const { keys, map, busyKey, groupSaveProgress, onToggle, onToggleGroup } = props;
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
      {Object.entries(grouped).map(([group, list]) => {
        const groupBusyIdValue = groupBusyId(group);
        const groupBusy = busyKey === groupBusyIdValue;
        const progress =
          groupSaveProgress?.group === groupBusyIdValue ? groupSaveProgress : null;
        const allChecked = list.every((key) => Boolean(map[key]));
        const someChecked = list.some((key) => Boolean(map[key]));

        return (
          <section
            key={group}
            aria-busy={groupBusy}
            className={[
              "relative rounded-lg border border-border p-4",
              groupBusy ? "border-brand/40 bg-brand/3" : "",
            ].join(" ")}
          >
            <label
              className={[
                "flex items-center gap-2 border-b border-border pb-2 text-sm",
                groupBusy ? "cursor-wait" : "cursor-pointer",
              ].join(" ")}
            >
              {groupBusy ? (
                <span
                  className="inline-flex size-5 shrink-0 items-center justify-center"
                  aria-hidden
                >
                  <Loader2 className="size-4 animate-spin text-brand" />
                </span>
              ) : (
                <input
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked && !allChecked;
                  }}
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => void onToggleGroup(list, e.target.checked)}
                  disabled={busyKey !== null}
                  aria-label={`Select all in ${group}`}
                  className={permissionCheckboxClass}
                />
              )}
              <span className="min-w-0 flex-1 font-medium">{group}</span>
              {groupBusy ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                  Saving
                  {progress && progress.total > 0
                    ? ` ${progress.done}/${progress.total}`
                    : null}
                  …
                </span>
              ) : (
                <span className="shrink-0 text-xs opacity-60">Select all</span>
              )}
            </label>
            <div
              className={[
                "mt-2 grid gap-1.5",
                groupBusy ? "pointer-events-none opacity-60" : "",
              ].join(" ")}
            >
              {list.map((key) => {
                const allowed = Boolean(map[key]);
                const label = permissionLabelForKey(key);
                return (
                  <label
                    key={key}
                    className="flex w-full cursor-pointer items-start gap-2 py-0.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={allowed}
                      onChange={(e) => void onToggle(key, e.target.checked)}
                      disabled={groupBusy || (busyKey !== null && busyKey !== key)}
                      className={`${permissionCheckboxClass} mt-0.5`}
                    />
                    <span className="min-w-0 flex-1 break-all font-mono text-xs leading-5">
                      {label}
                      {label !== key ? (
                        <span className="mt-0.5 block font-sans text-[11px] opacity-60">
                          {key}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
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
  const [permCache, setPermCache] = React.useState<
    Record<string, Record<string, boolean>>
  >({});
  const [permCacheLoading, setPermCacheLoading] = React.useState(false);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [groupSaveProgress, setGroupSaveProgress] =
    React.useState<GroupSaveProgress | null>(null);
  const [busyCapGroup, setBusyCapGroup] = React.useState<string | null>(null);
  const [capBanner, setCapBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);
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

  const capabilityRouteFilter = React.useMemo(() => {
    if (scope !== "line" || !selectedService) return null;
    return permissionKeysForModules(
      selectedService.enabledModules as CommercialModuleKey[],
    );
  }, [scope, selectedService]);

  const activeRoleId = scope === "global" ? globalRoleId : serviceRoleId;

  const globalBatchLoadedRef = React.useRef(false);
  const lineBatchLoadedForRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (status !== "ready" || !session?.userId || !isAdmin) return;
    if (scope === "global" && activeGlobalRoles.length > 0 && !globalBatchLoadedRef.current) {
      globalBatchLoadedRef.current = true;
      setPermCacheLoading(true);
      void getGlobalRolesPermissionsBatchAction()
        .then((batch) => {
          setPermCache((prev) => {
            const next = { ...prev };
            for (const [id, m] of Object.entries(batch)) {
              next[id] = m as unknown as Record<string, boolean>;
            }
            return next;
          });
        })
        .catch(() => {
          globalBatchLoadedRef.current = false;
        })
        .finally(() => setPermCacheLoading(false));
      return;
    }
    if (scope === "line" && commercialServiceId && rolesForLine.length > 0) {
      if (lineBatchLoadedForRef.current === commercialServiceId) return;
      lineBatchLoadedForRef.current = commercialServiceId;
      setPermCacheLoading(true);
      void getLineRolesPermissionsBatchAction(commercialServiceId)
        .then((batch) => {
          setPermCache((prev) => {
            const next = { ...prev };
            for (const [id, m] of Object.entries(batch)) {
              next[id] = m as unknown as Record<string, boolean>;
            }
            return next;
          });
        })
        .catch(() => {
          lineBatchLoadedForRef.current = null;
        })
        .finally(() => setPermCacheLoading(false));
    }
  }, [
    status,
    session?.userId,
    isAdmin,
    scope,
    commercialServiceId,
    activeGlobalRoles.length,
    rolesForLine.length,
  ]);

  React.useEffect(() => {
    if (status !== "ready" || !session?.userId || !isAdmin) return;
    if (scope === "global") {
      if (!globalRoleId) {
        setMap(null);
        return;
      }
      const cached = permCache[globalRoleId];
      if (cached) {
        setMap(cached);
        return;
      }
      setMap(null);
      void getGlobalRolePermissionsAction(globalRoleId)
        .then((m) => {
          const row = m as unknown as Record<string, boolean>;
          setMap(row);
          setPermCache((prev) => ({ ...prev, [globalRoleId]: row }));
        })
        .catch(() => setMap(null));
      return;
    }
    if (!serviceRoleId) {
      setMap(null);
      return;
    }
    const cached = permCache[serviceRoleId];
    if (cached) {
      setMap(cached);
      return;
    }
    setMap(null);
    void getServiceRolePermissionsAction(serviceRoleId)
      .then((m) => {
        const row = m as unknown as Record<string, boolean>;
        setMap(row);
        setPermCache((prev) => ({ ...prev, [serviceRoleId]: row }));
      })
      .catch(() => setMap(null));
  }, [
    status,
    session?.userId,
    isAdmin,
    scope,
    globalRoleId,
    serviceRoleId,
    permCache,
  ]);

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
      setMap((prev) => {
        if (!prev) return prev;
        const next = { ...prev, [key]: allowed };
        setPermCache((cache) =>
          globalRoleId ? { ...cache, [globalRoleId]: next } : cache,
        );
        return next;
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleGlobalGroup(keys: PermissionKey[], allowed: boolean) {
    if (!globalRoleId || !map) return;
    const group = groupForKey(keys[0] ?? ("" as PermissionKey));
    const toUpdate = keys.filter((key) => Boolean(map[key]) !== allowed);
    if (toUpdate.length === 0) return;
    const busyId = groupBusyId(group);
    setBusyKey(busyId);
    setGroupSaveProgress({ group: busyId, done: 0, total: toUpdate.length });
    setMap((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const key of toUpdate) next[key] = allowed;
      setPermCache((cache) =>
        globalRoleId ? { ...cache, [globalRoleId]: next } : cache,
      );
      return next;
    });
    try {
      for (let i = 0; i < toUpdate.length; i++) {
        const key = toUpdate[i]!;
        const fd = new FormData();
        fd.set("globalRoleId", globalRoleId);
        fd.set("key", key);
        fd.set("allowed", allowed ? "1" : "0");
        await setGlobalRolePermission(fd);
        setGroupSaveProgress({ group: busyId, done: i + 1, total: toUpdate.length });
      }
    } catch {
      const restored = await getGlobalRolePermissionsAction(globalRoleId);
      const row = restored as unknown as Record<string, boolean>;
      setMap(row);
      setPermCache((prev) => ({ ...prev, [globalRoleId]: row }));
    } finally {
      setBusyKey(null);
      setGroupSaveProgress(null);
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
      setMap((prev) => {
        if (!prev) return prev;
        const next = { ...prev, [key]: allowed };
        setPermCache((cache) =>
          serviceRoleId ? { ...cache, [serviceRoleId]: next } : cache,
        );
        return next;
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleLineGroup(keys: PermissionKey[], allowed: boolean) {
    if (!serviceRoleId || !map) return;
    const group = groupForKey(keys[0] ?? ("" as PermissionKey));
    const toUpdate = keys.filter((key) => Boolean(map[key]) !== allowed);
    if (toUpdate.length === 0) return;
    const busyId = groupBusyId(group);
    setBusyKey(busyId);
    setGroupSaveProgress({ group: busyId, done: 0, total: toUpdate.length });
    setMap((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const key of toUpdate) next[key] = allowed;
      setPermCache((cache) =>
        serviceRoleId ? { ...cache, [serviceRoleId]: next } : cache,
      );
      return next;
    });
    try {
      for (let i = 0; i < toUpdate.length; i++) {
        const key = toUpdate[i]!;
        const fd = new FormData();
        fd.set("serviceRoleId", serviceRoleId);
        fd.set("key", key);
        fd.set("allowed", allowed ? "1" : "0");
        await setServiceRolePermission(fd);
        setGroupSaveProgress({ group: busyId, done: i + 1, total: toUpdate.length });
      }
    } catch {
      const restored = await getServiceRolePermissionsAction(serviceRoleId);
      const row = restored as unknown as Record<string, boolean>;
      setMap(row);
      setPermCache((prev) => ({ ...prev, [serviceRoleId]: row }));
    } finally {
      setBusyKey(null);
      setGroupSaveProgress(null);
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
        const row = next as unknown as Record<string, boolean>;
        setMap(row);
        setPermCache((prev) => ({ ...prev, [globalRoleId]: row }));
      } else if (serviceRoleId) {
        const fd = new FormData();
        fd.set("serviceRoleId", serviceRoleId);
        await resetServiceRolePermissions(fd);
        const next = await getServiceRolePermissionsAction(serviceRoleId);
        const row = next as unknown as Record<string, boolean>;
        setMap(row);
        setPermCache((prev) => ({ ...prev, [serviceRoleId]: row }));
      }
    } finally {
      setBusyKey(null);
    }
  }

  const canResetGlobal = scope === "global" && Boolean(globalRoleId);
  const canResetLine = scope === "line" && Boolean(serviceRoleId);

  const hasLoadErrors = Boolean(loadErrors?.global || loadErrors?.line);

  async function onToggleCapabilityGroup(groupId: string, allowed: boolean) {
    if (!activeRoleId) return;
    setCapBanner(null);
    setBusyCapGroup(groupId);
    try {
      await setRoleAccessGroup(
        scope,
        activeRoleId,
        groupId,
        allowed,
        scope === "line" ? selectedService?.enabledModules : undefined,
      );
      const fresh =
        scope === "global"
          ? await getGlobalRolePermissionsAction(activeRoleId)
          : await getServiceRolePermissionsAction(activeRoleId);
      const row = fresh as unknown as Record<string, boolean>;
      setMap(row);
      setPermCache((prev) => ({ ...prev, [activeRoleId]: row }));
      setCapBanner({ type: "ok", text: "Capability group updated." });
    } catch (e) {
      setCapBanner({
        type: "error",
        text: e instanceof Error ? e.message : "Could not update capability group.",
      });
    } finally {
      setBusyCapGroup(null);
    }
  }

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

      <div className="flex flex-wrap gap-4">
        {scope === "line" ? (
          <>
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
                Routes limited to modules:{" "}
                {selectedService.enabledModules.join(", ") || "none"}
              </p>
            ) : null}
          </>
        ) : (
          <div className="grid gap-2">
            <label className="text-sm font-medium">Global role</label>
            <select
              className="h-10 rounded-md border border-border bg-transparent px-3 py-2 text-sm min-w-48"
              value={globalRoleId}
              onChange={(e) => setGlobalRoleId(e.target.value)}
              disabled={activeGlobalRoles.length === 0}
            >
              {activeGlobalRoles.length === 0 ? (
                <option value="">No active global roles</option>
              ) : (
                activeGlobalRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.displayName} ({r.code})
                  </option>
                ))
              )}
            </select>
          </div>
        )}
      </div>

      {capBanner ? (
        <p
          className={[
            "text-sm rounded-md border px-3 py-2",
            capBanner.type === "error"
              ? "border-destructive/40 text-destructive"
              : "border-brand/30 text-foreground",
          ].join(" ")}
        >
          {capBanner.text}
        </p>
      ) : null}

      {scope === "line" && lineCatalog.services.length === 0 ? (
        <p className="text-sm opacity-75">
          Add a commercial line under Setup → Services, then assign line roles
          under Users.
        </p>
      ) : !activeRoleId ? (
        <p className="text-sm opacity-75">Select a role to configure access.</p>
      ) : (
        <CapabilityGroupsPanel
          map={map}
          routeFilter={capabilityRouteFilter}
          busyGroupId={busyCapGroup}
          disabled={busyKey !== null || busyCapGroup !== null}
          onToggleGroup={(groupId, allowed) =>
            void onToggleCapabilityGroup(groupId, allowed)
          }
        />
      )}

      <details className="rounded-lg border border-border group">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-accent/10">
          Advanced: role definitions & individual permissions
        </summary>
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="flex flex-wrap justify-end">
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

          {scope === "line" && !serviceRoleId ? (
            <p className="text-sm opacity-75">
              Select or create a line role above to edit individual permissions.
            </p>
          ) : scope === "line" ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Individual permission keys</h3>
              <PermissionMatrix
                keys={visibleKeys}
                map={map}
                busyKey={busyKey}
                groupSaveProgress={groupSaveProgress}
                onToggle={(key, allowed) => void toggleLine(key, allowed)}
                onToggleGroup={(keys, allowed) =>
                  void toggleLineGroup(keys, allowed)
                }
              />
            </div>
          ) : globalRoleId ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Individual permission keys</h3>
              <PermissionMatrix
                keys={visibleKeys}
                map={map}
                busyKey={busyKey}
                groupSaveProgress={groupSaveProgress}
                onToggle={(key, allowed) => void toggleGlobal(key, allowed)}
                onToggleGroup={(keys, allowed) =>
                  void toggleGlobalGroup(keys, allowed)
                }
              />
            </div>
          ) : (
            <p className="text-sm opacity-75">
              Select a global role to edit individual permissions.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}

