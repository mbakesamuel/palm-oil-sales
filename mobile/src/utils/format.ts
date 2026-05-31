export function fmtKg(value: string | number | null | undefined): string {
  if (value == null || value === "") return "0 Kg";
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value} Kg`;
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n)} Kg`;
}

export function fmtQtyList(
  items: Array<{ uom: string; qty: string }> | undefined,
): string {
  if (!items?.length) return "—";
  return items.map((t) => fmtKg(t.qty).replace(" Kg", ` ${t.uom}`)).join(" · ");
}

export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}
