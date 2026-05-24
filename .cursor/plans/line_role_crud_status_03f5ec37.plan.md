---
name: Line Role CRUD Status
overview: "Line roles (`CommercialServiceRole`) are only partially manageable in the UI today: permissions can be edited, roles are auto-seeded and assignable, but there is no admin screen to create, rename, or deactivate line role definitions themselves."
todos:
  - id: optional-role-definitions-ui
    content: Add admin UI to create/edit/deactivate CommercialServiceRole per line (code, name, sortOrder, isActive)
    status: completed
  - id: optional-role-actions
    content: "Server actions with validation: unique code per line, block deactivate if users assigned"
    status: completed
  - id: optional-integrate-permissions
    content: Link role definitions UI with existing Line roles permissions tab in PermissionsClient
    status: completed
isProject: false
---

# Line role CRUD — current state

## Short answer

**No full CRUD UI for line roles.** You can manage **permissions** for existing line roles and **assign** them to users, but you cannot add, rename, or delete line role records through the app.

---

## What exists today

```mermaid
flowchart LR
  subgraph seed [Auto-seed only]
    CS[Save commercial line] --> ENSURE[ensureDefaultServiceRolesForCommercialService]
    ENSURE --> ROLES[(CommercialServiceRole rows)]
  end
  subgraph read [Read / assign]
    ROLES --> USERS[Users page dropdown]
    ROLES --> PERM_SELECT[Permissions Line roles tab]
  end
  subgraph perm_crud [Permission CRUD only]
    PERM_SELECT --> TOGGLE[Toggle route/ui keys]
    TOGGLE --> CSR_PERM[(CommercialServiceRolePermission)]
    RESET[Reset to defaults] --> CSR_PERM
  end
```

| Operation  | Line role record (`CommercialServiceRole`)                                                                                                    | Line role permissions (`CommercialServiceRolePermission`)                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Create** | Auto-only when a line has zero roles ([`lib/load-auth-session.ts`](lib/load-auth-session.ts) `ensureDefaultServiceRolesForCommercialService`) | Implicit on first load via `getPermissionsForServiceRole` seeding ([`lib/access-control.ts`](lib/access-control.ts)) |
| **Read**   | Listed on [Users](<app/(app)/users/page.tsx>) and [Permissions](<app/(app)/setup/permissions/page.tsx>)                                       | Line roles tab in [`PermissionsClient.tsx`](<app/(app)/setup/permissions/PermissionsClient.tsx>)                     |
| **Update** | Not in UI (code/name/sortOrder/isActive)                                                                                                      | Yes — toggle checkboxes + `setServiceRolePermission` in [`actions.ts`](<app/(app)/setup/permissions/actions.ts>)     |
| **Delete** | Not in UI                                                                                                                                     | Not in UI (only full reset of all keys for a role)                                                                   |

### Default roles (seeded once per line)

- **Sales point lines:** Sales clerk, Supervisor, BPO clerk in charge
- **Factory lines:** Factory clerk, Factory supervisor, Factory manager

Triggered when saving a line in [commercial-services/actions.ts](<app/(app)/setup/commercial-services/actions.ts>) if that line has no roles yet.

### Where admins interact today

1. **Setup → User Access control → Line roles** — pick commercial line + line role, edit **permission matrix** (not the role name/code).
2. **Users** — assign an existing line role to an operational user.
3. **Setup → Services** — saving a line may seed default roles; no role list editor on that page.

---

## What is missing for full line-role CRUD

To manage role **definitions** (not just permissions), you would need something like:

- New section under **Setup → Services** (per line) or **Setup → Permissions** (line roles tab extended)
- Server actions: `createCommercialServiceRole`, `updateCommercialServiceRole`, `deactivateCommercialServiceRole` (soft-delete via `isActive`)
- Guards: block delete/deactivate if users are assigned; unique `(commercialServiceId, code)`
- Optional: re-seed button or “Add role” with custom `code` + `name`

Estimated touchpoints:

- [`app/(app)/setup/permissions/`](<app/(app)/setup/permissions/>) or [`app/(app)/setup/commercial-services/`](<app/(app)/setup/commercial-services/>)
- New actions file or extend [`permissions/actions.ts`](<app/(app)/setup/permissions/actions.ts>)
- [`prisma/schema.prisma`](prisma/schema.prisma) — model already has `code`, `name`, `sortOrder`, `isActive` (no schema change required)

---

## Recommendation

If the goal is only to **tune access** for palm vs rubber staff, the current **Line roles** permissions tab is sufficient.

If you need **custom role titles** per line (e.g. “Weighbridge operator”) without DB edits, add a **line role definitions** UI as a follow-up task.
