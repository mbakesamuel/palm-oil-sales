import { RoleAccessClient } from "./RoleAccessClient";
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

export default async function RoleAccessPage() {
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
    loadErrors.global = catalogErrorMessage(globalResult.reason, "global roles");
    console.error("[role-access] global catalog:", globalResult.reason);
  }

  let lineCatalog = emptyLine;
  if (lineResult.status === "fulfilled") {
    lineCatalog = lineResult.value;
  } else {
    loadErrors.line = catalogErrorMessage(lineResult.reason, "line roles");
    console.error("[role-access] line catalog:", lineResult.reason);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Role access</h1>
        <p className="text-sm opacity-75">
          Configure which capability groups each global or line role may use.
          Mobile sign-in, reports, operations, and setup are managed here and
          stored in the database.
        </p>
      </div>
      <RoleAccessClient
        globalCatalog={globalCatalog}
        lineCatalog={lineCatalog}
        loadErrors={loadErrors}
      />
    </div>
  );
}
