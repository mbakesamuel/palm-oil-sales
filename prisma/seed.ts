import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureBotaPosSetup } from "../lib/pos/ensure-bota-setup";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding (see .env).");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Always available for local / QA sign-in. Replace with real provisioning in production. */
const TEST_ADMIN = {
  username: "puru",
  passwordPlain: "sammym1986",
  name: "Mbake Samuel",
} as const;

async function ensureBuiltinGlobalRoles() {
  for (const [legacyRole, displayName, sortOrder] of [
    [UserRole.ADMIN, "Admin", 10],
    [UserRole.DIRECTOR, "Director", 20],
  ] as const) {
    const existing = await prisma.globalRoleDefinition.findFirst({
      where: { legacyRole, isActive: true },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.globalRoleDefinition.create({
      data: {
        code: legacyRole.toLowerCase(),
        displayName,
        sortOrder,
        isActive: true,
        legacyRole,
      },
    });
  }
}

async function linkAdminGlobalRole(userId: string) {
  const def = await prisma.globalRoleDefinition.findFirst({
    where: { legacyRole: UserRole.ADMIN, isActive: true },
    select: { id: true },
  });
  if (!def) return;
  await prisma.user.update({
    where: { id: userId },
    data: { globalRoleDefinitionId: def.id, role: UserRole.ADMIN },
  });
}

async function main() {
  await ensureBuiltinGlobalRoles();

  const existing = await prisma.user.findUnique({
    where: { username: TEST_ADMIN.username },
  });

  if (existing) {
    await prisma.user.update({
      where: { username: TEST_ADMIN.username },
      data: {
        name: TEST_ADMIN.name,
        passwordPlain: TEST_ADMIN.passwordPlain,
        role: UserRole.ADMIN,
        isActive: true,
        salesPointId: null,
      },
    });
    await linkAdminGlobalRole(existing.id);
    console.log(
      `Seed: updated user "${TEST_ADMIN.username}" (password: "${TEST_ADMIN.passwordPlain}")`,
    );
    await ensureBotaPosSetup(prisma);
    console.log("Seed: ensured Bota sales point, Bottle Oil Store, and walk-in customer.");
    return;
  }

  await prisma.user.create({
    data: {
      username: TEST_ADMIN.username,
      name: TEST_ADMIN.name,
      passwordPlain: TEST_ADMIN.passwordPlain,
      role: UserRole.ADMIN,
      salesPointId: null,
    },
  });
  const created = await prisma.user.findUniqueOrThrow({
    where: { username: TEST_ADMIN.username },
    select: { id: true },
  });
  await linkAdminGlobalRole(created.id);
  console.log(
    `Seed: created user "${TEST_ADMIN.username}" (password: "${TEST_ADMIN.passwordPlain}")`,
  );

  await ensureBotaPosSetup(prisma);
  console.log("Seed: ensured Bota sales point, Bottle Oil Store, and walk-in customer.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
