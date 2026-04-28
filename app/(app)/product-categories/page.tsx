import { getPrismaClient } from "@/lib/prisma";
import { ProductCategoriesClient } from "./ProductCategoriesClient";
import { deleteProductCat, saveProductCat } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProductCategoriesPage() {
  const prisma = getPrismaClient();
  const categories = await prisma.productCat.findMany({
    orderBy: { productCat: "asc" },
    select: { productCatId: true, productCat: true, productCode: true },
  });

  return (
    <ProductCategoriesClient
      categories={categories}
      saveProductCatAction={saveProductCat}
      deleteProductCatAction={deleteProductCat}
    />
  );
}
