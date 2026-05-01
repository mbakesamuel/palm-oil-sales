import { PermissionsClient } from "./PermissionsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PermissionsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Access control</h1>
        <p className="text-sm opacity-75">
          Configure which roles can access routes and which UI controls are visible. Only Admin can edit this page.
        </p>
      </div>
      <PermissionsClient />
    </div>
  );
}

