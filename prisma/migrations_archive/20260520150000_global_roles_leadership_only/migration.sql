-- GlobalRoleDefinition is metadata for org-wide roles only (not line staff enum values).

DELETE FROM "GlobalRoleDefinition"
WHERE "role" NOT IN ('ADMIN', 'DIRECTOR', 'MANAGER', 'OFFICER');
