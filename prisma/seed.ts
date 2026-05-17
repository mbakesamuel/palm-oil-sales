import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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
  name: "Test administrator",
} as const;

async function main() {
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
    console.log(
      `Seed: updated user "${TEST_ADMIN.username}" (password: "${TEST_ADMIN.passwordPlain}")`,
    );
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
  console.log(
    `Seed: created user "${TEST_ADMIN.username}" (password: "${TEST_ADMIN.passwordPlain}")`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
