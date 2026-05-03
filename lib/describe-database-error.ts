import "server-only";

import { Prisma } from "@prisma/client";

/** User-facing copy for DB / migration issues so RSC pages avoid throwing into the client console. */
export function describeDatabaseError(e: unknown): { title: string; description: string } {
  const msg = e instanceof Error ? e.message : String(e ?? "");

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (
      e.code === "P2021" ||
      e.code === "P2010" ||
      /does not exist in the current database/i.test(msg)
    ) {
      return {
        title: "Database schema is out of date",
        description:
          "Required tables are missing. From the project folder, run: npx prisma migrate deploy — " +
          "then reload this page. Use the same DATABASE_URL as this app.",
      };
    }
    if (
      e.code === "P1001" ||
      e.code === "ETIMEDOUT" ||
      e.code === "EAI_AGAIN" ||
      e.code === "ENOTFOUND"
    ) {
      return {
        title: "Cannot reach the database",
        description:
          "The server timed out or could not connect. Check DATABASE_URL, VPN or firewall, and " +
          "whether your database host is running — then try again.",
      };
    }
  }

  if (/ETIMEDOUT|ECONNRESET|EAI_AGAIN|Can't reach database/i.test(msg)) {
    return {
      title: "Cannot reach the database",
      description:
        "The connection failed or timed out. Wait a moment and retry, or check your network and database URL.",
    };
  }

  if (/does not exist in the current database/i.test(msg)) {
    return {
      title: "Database schema is out of date",
      description:
        "Apply migrations (npx prisma migrate deploy) against the database configured in DATABASE_URL, then reload.",
    };
  }

  return {
    title: "Could not load data",
    description:
      "A database error occurred. If it keeps happening, share this with an administrator: " +
      (msg ? msg.slice(0, 200) : "unknown error"),
  };
}
