import { getPrismaClient } from "@/lib/prisma";
import { ProductsClient } from "./ProductsClient";
import { deleteProduct, saveProduct } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProductsPage() {
  const prisma = getPrismaClient();
  const [categories, products] = await Promise.all([
    prisma.productCat.findMany({
      orderBy: { productCat: "asc" },
      select: { productCatId: true, productCat: true, productCode: true },
    }),
    prisma.product.findMany({
      orderBy: { productName: "asc" },
      select: {
        productId: true,
        productName: true,
        productCode: true,
        productCatId: true,
        isBottledPalmOil: true,
        productCat: { select: { productCatId: true, productCat: true } },
      },
    }),
  ]);

  return (
    <ProductsClient
      categories={categories}
      products={products}
      saveProductAction={saveProduct}
      deleteProductAction={deleteProduct}
    />
  );
}
