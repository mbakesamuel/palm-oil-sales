import { PermissionsClient } from "./PermissionsClient";
import {
  getGlobalRolesCatalogAction,
  getLinePermissionsCatalogAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function catalogErrorMessage(err: unknown, label: string): string {
  if (err instanceof Error) return err.message;
  return `Could not load ${label}.`;
}

export default async function PermissionsPage() {
  const emptyGlobal = { roles: [] } as Awaited<
    ReturnType<typeof getGlobalRolesCatalogAction>
  >;
  const emptyLine = { services: [], roles: [] } as Awaited<
    ReturnType<typeof getLinePermissionsCatalogAction>
  >;

  const loadErrors: { global?: string; line?: string } = {};

  const [globalResult, lineResult] = await Promise.allSettled([
    getGlobalRolesCatalogAction(),
    getLinePermissionsCatalogAction(),
  ]);

  let globalCatalog = emptyGlobal;
  if (globalResult.status === "fulfilled") {
    globalCatalog = globalResult.value;
  } else {
    const message = catalogErrorMessage(globalResult.reason, "global roles");
    loadErrors.global = message;
    console.error("[permissions] global catalog:", globalResult.reason);
  }

  let lineCatalog = emptyLine;
  if (lineResult.status === "fulfilled") {
    lineCatalog = lineResult.value;
  } else {
    const message = catalogErrorMessage(lineResult.reason, "line roles");
    loadErrors.line = message;
    console.error("[permissions] line catalog:", lineResult.reason);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">User Roles and Access Control (Permissions)</h1>
        <p className="text-sm opacity-75">
          Configure global app roles (Director, Manager, Officers), define line roles per
          service, and set route permissions for each role. Only
          administrators can edit this page.
        </p>
      </div>
      <PermissionsClient
        globalCatalog={globalCatalog}
        lineCatalog={lineCatalog}
        loadErrors={loadErrors}
      />
    </div>
  );
}
