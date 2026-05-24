import { redirect } from "next/navigation";

/** @deprecated Variants removed — manage bottled SKUs on Products. */
export default function BpoVariantsRedirectPage() {
  redirect("/products");
}
