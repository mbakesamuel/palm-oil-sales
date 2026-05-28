import { redirect } from "next/navigation";

/** Variants removed — each bottled SKU is its own product. */
export default function ProductVariantsRedirectPage() {
  redirect("/products");
}
