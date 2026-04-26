"use client";

import * as React from "react";
import { UserRole } from "@prisma/client";

type Customer = {
  id: string;
  name: string;
  taxRegimeId: string;
  taxRegime: { name: string; vatApplies: boolean };
};
type Product = { productId: number; productName: string; productCat: { productCat: string } };
type User = {
  id: string;
  name: string;
  role: UserRole;
};

type Line = { productId: string; qtyKg: string; unitPricePerKg: string };
type Payment = { method: "CASH" | "CHEQUE"; amount: string; chequeNo?: string };

export function PosForm(props: {
  customers: Customer[];
  grades: Product[];
  users: User[];
  vatRateDecimal: string;
  action: (formData: FormData) => void;
}) {
  const { customers, grades, users, vatRateDecimal, action } = props;

  const [customerId, setCustomerId] = React.useState(customers[0]?.id ?? "");
  const [cashierId, setCashierId] = React.useState(users[0]?.id ?? "");
  const [lines, setLines] = React.useState<Line[]>([
    { productId: String(grades[0]?.productId ?? ""), qtyKg: "1", unitPricePerKg: "0" },
  ]);
  const [payments, setPayments] = React.useState<Payment[]>([
    { method: "CASH", amount: "0" },
  ]);

  const customer = customers.find((c) => c.id === customerId);
  const vatApplicable = customer?.taxRegime.vatApplies ?? false;
  const vatRate = vatApplicable ? Number.parseFloat(vatRateDecimal) : 0;

  const net = lines.reduce((sum, l) => {
    const qty = Number.parseFloat(l.qtyKg || "0") || 0;
    const price = Number.parseFloat(l.unitPricePerKg || "0") || 0;
    return sum + qty * price;
  }, 0);
  const vat = Math.round(net * vatRate * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;

  const paid = payments.reduce((sum, p) => sum + (Number.parseFloat(p.amount || "0") || 0), 0);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="createdByUserId" value={cashierId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="payments" value={JSON.stringify(payments)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Customer</label>
          <select
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="text-xs opacity-70">
            VAT: {vatApplicable ? "applies" : "exempt"} · Regime: {customer?.taxRegime.name ?? "-"}
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Cashier</label>
          <select
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            value={cashierId}
            onChange={(e) => setCashierId(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <div className="text-xs opacity-70 min-h-4">&nbsp;</div>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Items</h2>
          <button
            type="button"
            className="text-sm underline underline-offset-4"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { productId: String(grades[0]?.productId ?? ""), qtyKg: "1", unitPricePerKg: "0" },
              ])
            }
          >
            Add line
          </button>
        </div>

        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-5">Product</div>
            <div className="col-span-3">Qty (kg)</div>
            <div className="col-span-3">Price / kg</div>
            <div className="col-span-1" />
          </div>
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
              <div className="col-span-5">
                <select
                  className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                  value={l.productId}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)),
                    )
                  }
                >
                  {grades.map((g) => (
                    <option key={g.productId} value={String(g.productId)}>
                      {g.productName} ({g.productCat.productCat})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <input
                  className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                  value={l.qtyKg}
                  inputMode="decimal"
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, qtyKg: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div className="col-span-3">
                <input
                  className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                  value={l.unitPricePerKg}
                  inputMode="decimal"
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, unitPricePerKg: e.target.value } : x,
                      ),
                    )
                  }
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  className="text-xs underline underline-offset-4 opacity-80"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={lines.length === 1}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Payment</h2>
          <button
            type="button"
            className="text-sm underline underline-offset-4"
            onClick={() => setPayments((prev) => [...prev, { method: "CASH", amount: "0" }])}
          >
            Add payment line
          </button>
        </div>

        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-4">Method</div>
            <div className="col-span-4">Amount</div>
            <div className="col-span-3">Cheque #</div>
            <div className="col-span-1" />
          </div>
          {payments.map((p, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
              <div className="col-span-4">
                <select
                  className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                  value={p.method}
                  onChange={(e) =>
                    setPayments((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, method: e.target.value as Payment["method"] } : x,
                      ),
                    )
                  }
                >
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <div className="col-span-4">
                <input
                  className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                  value={p.amount}
                  inputMode="decimal"
                  onChange={(e) =>
                    setPayments((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div className="col-span-3">
                <input
                  className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                  value={p.chequeNo ?? ""}
                  placeholder={p.method === "CHEQUE" ? "Cheque number" : ""}
                  disabled={p.method !== "CHEQUE"}
                  onChange={(e) =>
                    setPayments((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, chequeNo: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  className="text-xs underline underline-offset-4 opacity-80"
                  onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={payments.length === 1}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-black/10 dark:border-white/10 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="opacity-75">Net</span>
          <span>{net.toFixed(2)} XAF</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="opacity-75">VAT</span>
          <span>{vat.toFixed(2)} XAF</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span>Total</span>
          <span>{gross.toFixed(2)} XAF</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="opacity-75">Paid</span>
          <span>{paid.toFixed(2)} XAF</span>
        </div>
        <div className="text-xs opacity-70">No credit sales: paid must equal total.</div>
      </section>

      <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
        Create sale
      </button>
    </form>
  );
}
