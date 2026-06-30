import "dotenv/config";
import { defineConfig } from "prisma/config";

const fallbackUrl =
  "postgresql://postgres:postgres@localhost:5432/palm_oil_pos?schema=public";
  

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackUrl,
  },
});

