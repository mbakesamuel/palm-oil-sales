export type CustomerTypeOption = {
  id: string;
  code: string;
  name: string;
};

export function customerTypeSortRank(
  id: string | null,
  options: CustomerTypeOption[],
): number {
  if (!id) return -1;
  const idx = options.findIndex((o) => o.id === id);
  return idx >= 0 ? idx : 99;
}

export function crosstabColumnLabel(opt: CustomerTypeOption): string {
  if (opt.code === "WORKER") return "ESTATES";
  return opt.name.trim().toUpperCase() || opt.code;
}
