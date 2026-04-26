import { getPrismaClient } from "@/lib/prisma";
import { createProduct, createProductCat } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProductsPage() {
  const prisma = getPrismaClient();
  const [cats, products] = await Promise.all([
    prisma.productCat.findMany({
      orderBy: { productCat: "asc" },
      select: { productCatId: true, productCat: true, productCode: true, createdAt: true },
    }),
    prisma.product.findMany({
      orderBy: { productName: "asc" },
      select: {
        productId: true,
        productName: true,
        productCode: true,
        productCat: { select: { productCatId: true, productCat: true } },
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="text-sm opacity-75">
          Manage products and categories (ProductCat).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={createProductCat} className="space-y-4 max-w-xl">
          <div className="text-sm font-semibold">Add category</div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="productCat">
              Category name
            </label>
            <input
              id="productCat"
              name="productCat"
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="catCode">
              Category code
            </label>
            <input
              id="catCode"
              name="productCode"
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              required
            />
          </div>

          <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
            Add category
          </button>
        </form>

        <form action={createProduct} className="space-y-4 max-w-xl">
          <div className="text-sm font-semibold">Add product</div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="productName">
              Product name
            </label>
            <input
              id="productName"
              name="productName"
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="productCode">
              Product code (optional)
            </label>
            <input
              id="productCode"
              name="productCode"
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="productCatId">
              Category
            </label>
            <select
              id="productCatId"
              name="productCatId"
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              defaultValue={cats[0]?.productCatId}
              required
              disabled={cats.length === 0}
            >
              {cats.map((c) => (
                <option key={c.productCatId} value={c.productCatId}>
                  {c.productCat} ({c.productCode})
                </option>
              ))}
            </select>
            {cats.length === 0 ? (
              <div className="text-xs opacity-70">Create a category first.</div>
            ) : null}
          </div>

          <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
            Add product
          </button>
        </form>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Categories</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          {cats.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No categories yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {cats.map((c) => (
                <li
                  key={c.productCatId}
                  className="px-3 py-2 text-sm flex items-center justify-between"
                >
                  <span className="font-medium">
                    {c.productCat} <span className="opacity-70">({c.productCode})</span>
                  </span>
                  <span className="opacity-70">{c.createdAt.toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Products</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          {products.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No products yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {products.map((p) => (
                <li
                  key={p.productId}
                  className="px-3 py-2 text-sm flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.productName}</div>
                    <div className="text-xs opacity-70">
                      Cat: {p.productCat.productCat}
                      {p.productCode ? ` · Code: ${p.productCode}` : ""}
                    </div>
                  </div>
                  <span className="opacity-70">{p.createdAt.toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

