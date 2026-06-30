import fs from "fs";

const path = "app/(app)/pos/actions.ts";
let src = fs.readFileSync(path, "utf8");

const createSaleStart = src.indexOf("export async function createSale(formData: FormData)");
const previewTaxesStart = src.indexOf("export async function previewPosTaxes(");
if (createSaleStart === -1 || previewTaxesStart === -1) {
  console.error("anchors not found");
  process.exit(1);
}

const newCreateSale = `export async function createSale(formData: FormData): Promise<SaveSaleResult> {
  try {
    await assertPermissionKey("route:/pos");
    const session = await getServerSession();
    if (!session?.userId) return { ok: false, error: "Login required." };
    const result = await createSaleForSession(
      session,
      createSaleInputFromFormData(formData),
    );
    if (result.ok) {
      revalidatePath("/pos");
      revalidatePath("/dashboard");
    }
    return result;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }
}

`;

src = src.slice(0, createSaleStart) + newCreateSale + src.slice(previewTaxesStart);

// Replace previewPosTaxes
src = src.replace(
  /export async function previewPosTaxes\([\s\S]*?\n\}\n\nexport type PosLineStockPreview/,
  `export async function previewPosTaxes(
  customerId: string,
  transactionIso: string,
): Promise<{ ok: true; taxes: PosTaxPreviewRow[] } | { ok: false; error: string }> {
  try {
    await assertPermissionKey("route:/pos");
    const session = await getServerSession();
    if (!session?.userId) return { ok: false, error: "Login required." };
    return previewPosTaxesForSession(session, customerId, transactionIso);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }
}

export type PosLineStockPreview`,
);

// Replace previewPosLineStock
src = src.replace(
  /export async function previewPosLineStock\([\s\S]*?\n\}\n\nfunction money2Print/,
  `export async function previewPosLineStock(
  salesPointIdRaw: string,
  storageLocationIdRaw: string,
  productIdRaw: string,
): Promise<PosLineStockPreview> {
  try {
    await assertPermissionKey("route:/pos");
    const session = await getServerSession();
    if (!session?.userId) return { ok: false, error: "Login required." };
    return previewPosLineStockForSession(
      session,
      Number.parseInt(String(salesPointIdRaw ?? "").trim(), 10),
      Number.parseInt(String(storageLocationIdRaw ?? "").trim(), 10),
      Number.parseInt(String(productIdRaw ?? "").trim(), 10),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }
}

function money2Print`,
);

// Remove duplicate PosLineStockPreview type if still inline - keep export type PosLineStockPreview from import

// Replace listAvailableDeliveryOrdersForSale
src = src.replace(
  /export type AvailableDeliveryOrderRow = \{[\s\S]*?\};\n\n\/\*\*[\s\S]*?\nexport async function listAvailableDeliveryOrdersForSale\([\s\S]*?\n\}\n\nexport async function lookupDeliveryOrderForSale/,
  `export async function listAvailableDeliveryOrdersForSale(
  salesPointIdRaw: string,
): Promise<AvailableDeliveryOrderRow[]> {
  const salesPointId = Number.parseInt(String(salesPointIdRaw ?? "").trim(), 10);
  if (!Number.isFinite(salesPointId)) return [];
  try {
    await assertPermissionKey("route:/pos");
    const session = await getServerSession();
    if (!session?.userId) return [];
    return listAvailableDeliveryOrdersForSession(session, salesPointId);
  } catch {
    return [];
  }
}

export async function lookupDeliveryOrderForSale`,
);

// Replace lookupDeliveryOrderForSale
src = src.replace(
  /export async function lookupDeliveryOrderForSale\([\s\S]*?\n\}\n\nexport async function deleteSale/,
  `export async function lookupDeliveryOrderForSale(
  rawNo: string,
  selectedCustomerId: string,
): Promise<
  | { ok: true; data: DeliveryOrderLookupDto & { customerMatches: boolean } }
  | { ok: false; error: string }
> {
  try {
    await assertPermissionKey("route:/pos");
    const session = await getServerSession();
    if (!session?.userId) return { ok: false, error: "Login required." };
    return lookupDeliveryOrderForSession(session, rawNo, selectedCustomerId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }
}

export async function deleteSale`,
);

fs.writeFileSync(path, src);
console.log("Refactored actions.ts");
