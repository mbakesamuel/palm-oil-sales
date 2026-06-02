"use client";

import { Loader2 } from "lucide-react";
import {
  ROLE_ACCESS_GROUPS,
  groupStateForPermissions,
} from "@/lib/role-access-groups";
import type { PermissionKey } from "@/lib/access-control-keys";

const checkboxClass =
  "m-0 size-5 shrink-0 cursor-pointer rounded border-border accent-brand disabled:cursor-not-allowed";

export function CapabilityGroupsPanel(props: {
  map: Record<string, boolean> | null;
  routeFilter: ReadonlySet<PermissionKey> | null;
  busyGroupId: string | null;
  disabled: boolean;
  onToggleGroup: (groupId: string, allowed: boolean) => void;
}) {
  const { map, routeFilter, busyGroupId, disabled, onToggleGroup } = props;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Capability groups</h2>
        <p className="text-xs opacity-70 mt-1">
          Turn on areas of the app (web and mobile) for the selected role. Use
          advanced settings below for individual permission keys or role
          definitions.
        </p>
      </div>
      <div className="space-y-3">
        {ROLE_ACCESS_GROUPS.map((group) => {
          const state = groupStateForPermissions(map, group.id, routeFilter);
          const busy = busyGroupId === group.id;
          const checked = state === "on";

          return (
            <div
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
                    disabled={
                      disabled || busy || state === "loading" || !map
                    }
                    onChange={(e) => onToggleGroup(group.id, e.target.checked)}
                  />
                )}
                <span className="min-w-0">
                  <span className="font-medium text-sm block">{group.label}</span>
                  <span className="text-xs opacity-70 block mt-0.5">
                    {group.description}
                  </span>
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
