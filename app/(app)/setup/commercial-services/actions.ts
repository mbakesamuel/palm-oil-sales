"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getServerSession } from "@/lib/auth-server";
import { getPrismaClient } from "@/lib/prisma";
import { DEFAULT_COMMERCIAL_SERVICE_CODE } from "@/lib/commercial-service";
import {
  COMMERCIAL_MODULE_KEYS,
  type CommercialModuleKey,
  defaultModulesForSiteKind,
} from "@/lib/commercial-modules";
import { ensureDefaultServiceRolesForCommercialService } from "@/lib/load-auth-session";
import { CommercialSiteKind } from "@prisma/client";
import { revalidatePath } from "next/cache";

function normalizeCode(raw: string) {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.length ? s : null;
}

function normalizeInvoicePrefix(raw: string) {
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return s.length ? s.slice(0, 16) : null;
}

function parseSiteKind(raw: string): CommercialSiteKind {
  const v = String(raw ?? "").trim();
  if (v === "FACTORY") return CommercialSiteKind.FACTORY;
  return CommercialSiteKind.SALES_POINT;
}

function parseEnabledModules(formData: FormData, siteKind: CommercialSiteKind): CommercialModuleKey[] {
  const selected = formData
    .getAll("enabledModule")
    .map((x) => String(x).trim())
    .filter((x): x is CommercialModuleKey =>
      (COMMERCIAL_MODULE_KEYS as readonly string[]).includes(x),
    );
  if (selected.length > 0) return selected;
  return defaultModulesForSiteKind(siteKind);
}

export async function saveCommercialService(formData: FormData) {
  await assertPermissionKey("route:/setup");
  const prisma = getPrismaClient();

  const id = String(formData.get("id") ?? "").trim() || null;
  const codeRaw = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const invoicePrefixRaw = String(formData.get("invoicePrefix") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10);
  const isActive = formData.getAll("isActive").includes("1");
  const siteKind = parseSiteKind(String(formData.get("siteKind") ?? ""));
  const enabledModules = parseEnabledModules(formData, siteKind);

  const codeInput = normalizeCode(codeRaw);
  const invoicePrefix = normalizeInvoicePrefix(invoicePrefixRaw);
  if (!codeInput) throw new Error("Code is required (letters, numbers, underscores).");
  if (!name) throw new Error("Display name is required.");
  if (!invoicePrefix) throw new Error("Invoice prefix is required (A–Z, 0–9, hyphen).");

  if (id) {
    const existing = await prisma.commercialService.findUnique({ where: { id } });
    if (!existing) throw new Error("Service not found.");

    const effectiveCode =
      existing.code === DEFAULT_COMMERCIAL_SERVICE_CODE ? DEFAULT_COMMERCIAL_SERVICE_CODE : codeInput;

    if (existing.code === DEFAULT_COMMERCIAL_SERVICE_CODE && codeInput !== DEFAULT_COMMERCIAL_SERVICE_CODE) {
      throw new Error("The default service code cannot be changed.");
    }

    const codeClash = await prisma.commercialService.findFirst({
      where: { code: effectiveCode, id: { not: id } },
      select: { id: true },
    });
    if (codeClash) throw new Error("That code is already in use.");

    const prefixClash = await prisma.commercialService.findFirst({
      where: { invoicePrefix, id: { not: id } },
      select: { id: true },
    });
    if (prefixClash) throw new Error("That invoice prefix is already in use.");

    await prisma.commercialService.update({
      where: { id },
      data: {
        code: effectiveCode,
        name,
        invoicePrefix,
        phone,
        address,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        isActive,
        siteKind,
        enabledModules,
      },
    });

    await ensureDefaultServiceRolesForCommercialService(id, siteKind);
  } else {
    const codeClash = await prisma.commercialService.findUnique({
      where: { code: codeInput },
      select: { id: true },
    });
    if (codeClash) throw new Error("That code is already in use.");

    const prefixClash = await prisma.commercialService.findUnique({
      where: { invoicePrefix },
      select: { id: true },
    });
    if (prefixClash) throw new Error("That invoice prefix is already in use.");

    const created = await prisma.commercialService.create({
      data: {
        code: codeInput,
        name,
        invoicePrefix,
        phone,
        address,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        isActive,
        siteKind,
        enabledModules,
      },
    });

    await ensureDefaultServiceRolesForCommercialService(created.id, siteKind);
  }

  revalidatePath("/setup/commercial-services");
  revalidatePath("/setup");
  revalidatePath("/users");
  revalidatePath("/setup/permissions");

  const current = await getServerSession();
  if (id != null && id === current?.commercialService?.id) {
    revalidatePath("/");
    revalidatePath("/dashboard");
  }
}
