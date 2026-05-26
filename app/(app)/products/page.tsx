import { getServerSession } from "@/lib/auth-server";
import { canPickProductCommercialLine } from "@/lib/product-commercial";
import { getPrismaClient } from "@/lib/prisma";
import { productWhereForScope, resolveServiceScope } from "@/lib/service-scope";
import { ProductsClient } from "./ProductsClient";
import { deleteProduct, saveProduct } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProductsPage() {
  const prisma = getPrismaClient();
  const session = await getServerSession();
  const scope = session ? resolveServiceScope(session) : { mode: "all" as const };
  const canPickCommercialLine = canPickProductCommercialLine(session?.role);
  const assignedLineId = session?.commercialService?.id ?? null;
  const assignedLineLabel = session?.commercialService?.name ?? null;
  const productWhere = canPickCommercialLine ? undefined : productWhereForScope(scope);

  const [categories, commercialServices, products] = await Promise.all([
    prisma.productCat.findMany({
      orderBy: { productCat: "asc" },
      select: {
        productCatId: true,
        productCat: true,
        productCode: true,
        isBottled: true,
      },
    }),
    prisma.commercialService.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, invoicePrefix: true, isActive: true },
    }),
    prisma.product.findMany({
      where: productWhere,
      orderBy: { productName: "asc" },
      select: {
        productId: true,
        productName: true,
        productCode: true,
        productCatId: true,
        uom: true,
        commercialServiceId: true,
        productCat: {
          select: { productCatId: true, productCat: true, isBottled: true },
        },
        commercialService: { select: { id: true, name: true, invoicePrefix: true } },
      },
    }),
  ]);

  const canManageProducts =
    canPickCommercialLine || Boolean(assignedLineId);

  return (
    <ProductsClient
      categories={categories}
      commercialServices={commercialServices}
      products={products}
      canPickCommercialLine={canPickCommercialLine}
      defaultCommercialServiceId={assignedLineId}
      assignedLineLabel={assignedLineLabel}
      canManageProducts={canManageProducts}
      saveProductAction={saveProduct}
      deleteProductAction={deleteProduct}
    />
  );
}
