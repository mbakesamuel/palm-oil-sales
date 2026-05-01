import "server-only";

import { Prisma } from "@prisma/client";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isTransientDbNetworkError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P1001") {
    return true;
  }
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return (
    /Can't reach database server/i.test(msg) ||
    /Client network socket disconnected before secure TLS connection was established/i.test(
      msg,
    ) ||
    /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND/i.test(msg)
  );
}

/**
 * Retries a Prisma call on transient network/TLS errors (common with pooled connections).
 * Keep small to avoid masking real failures.
 */
export async function prismaRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; baseDelayMs?: number },
): Promise<T> {
  const retries = Math.max(0, opts?.retries ?? 3);
  const baseDelayMs = Math.max(50, opts?.baseDelayMs ?? 250);

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries || !isTransientDbNetworkError(e)) throw e;
      const delay = baseDelayMs * Math.pow(2, attempt);
      attempt += 1;
      await sleep(delay);
    }
  }
}

