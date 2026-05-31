"use server";

import {
  getGlobalRolesCatalogAction,
  getGlobalRolePermissionsAction,
  getLinePermissionsCatalogAction,
  getServiceRolePermissionsAction,
  setGlobalRolePermission,
  setServiceRolePermission,
} from "@/app/(app)/setup/permissions/actions";
import { assertActorIsAdmin, assertPermissionKey } from "@/lib/access-control";
import type { PermissionKey } from "@/lib/access-control-keys";
import {
  ROLE_ACCESS_GROUPS,
  groupKeysForModules,
} from "@/lib/role-access-groups";
import {
  permissionKeysForModules,
  type CommercialModuleKey,
} from "@/lib/commercial-modules";
import { revalidatePath } from "next/cache";

export {
  getGlobalRolesCatalogAction,
  getLinePermissionsCatalogAction,
};

export type RoleAccessScope = "global" | "line";

async function assertCanManageRoleAccess() {
  await assertPermissionKey("route:/setup/role-access");
  await assertActorIsAdmin();
}

export async function getRoleAccessPermissionsAction(
  scope: RoleAccessScope,
  roleId: string,
) {
  await assertCanManageRoleAccess();
  if (scope === "global") {
    return getGlobalRolePermissionsAction(roleId);
  }
  return getServiceRolePermissionsAction(roleId);
}

function allowedRouteKeysForLine(enabledModules: readonly string[]) {
  return permissionKeysForModules(enabledModules as CommercialModuleKey[]);
}

export async function setRoleAccessGroup(
  scope: RoleAccessScope,
  roleId: string,
  groupId: string,
  allowed: boolean,
  enabledModules?: readonly string[],
) {
  await assertCanManageRoleAccess();

  const group = ROLE_ACCESS_GROUPS.find((g) => g.id === groupId);
  if (!group) throw new Error("Unknown capability group.");

  const routeFilter =
    scope === "line" && enabledModules
      ? allowedRouteKeysForLine(enabledModules)
      : null;

  const keys =
    routeFilter != null
      ? groupKeysForModules(group, routeFilter)
      : [...group.keys];

  for (const key of keys) {
    const fd = new FormData();
    fd.set("allowed", allowed ? "1" : "0");
    fd.set("key", key);
    if (scope === "global") {
      fd.set("globalRoleId", roleId);
      await setGlobalRolePermission(fd);
    } else {
      fd.set("serviceRoleId", roleId);
      await setServiceRolePermission(fd);
    }
  }

  revalidatePath("/setup/role-access");
}
