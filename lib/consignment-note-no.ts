import "server-only";

import { getPrismaClient } from "@/lib/prisma";

function pad(num: number, len: number) {
  return String(num).padStart(len, "0");
}

export async function allocateConsignmentNoteNo(issuedAt: Date): Promise<string> {
  const year = issuedAt.getFullYear();
  const prisma = getPrismaClient();
  const seq = await prisma.vehicleConsignmentNoteSequence.upsert({
    where: { id: "default" },
    create: { id: "default", nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  const allocated = seq.nextNumber - 1;
  return `VCN-${year}-${pad(allocated, 6)}`;
}
