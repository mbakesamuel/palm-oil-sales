"use client";

import * as React from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Customer = { id: string; name: string };
type Product = { productId: number; productName: string; productCat: { productCat: string } };

type Line = { productId: string; orderQty: string; orderUnit: string; unitPrice: string };
type Payment = {
  method: "CASH" | "CHEQUE";
  paymentDate: string;
  chequeNo: string;
  bank: string;
  cashReceiptNo: string;
  receiptDate: string;
};

type OrderRow = {
  id: number;
  deliveryOrderNo: string;
  dateIssuedIso: string;
  customerName: string;
  lineCount: number;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function DeliveryOrdersClient(props: {
  customers: Customer[];
  products: Product[];
  orders: OrderRow[];
  createDeliveryOrderAction: (formData: FormData) => void;
  deleteDeliveryOrderAction: (formData: FormData) => void;
}) {
  const { customers, products, orders, createDeliveryOrderAction, deleteDeliveryOrderAction } = props;

  const [customerId, setCustomerId] = React.useState(customers[0]?.id ?? "");
  const [dateIssued, setDateIssued] = React.useState(todayIsoDate);
  const [orderRef, setOrderRef] = React.useState("");
  const [collectionPoint, setCollectionPoint] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([
    {
      productId: String(products[0]?.productId ?? ""),
      orderQty: "1",
      orderUnit: "kg",
      unitPrice: "",
    },
  ]);
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: number;
    label: string;
  } | null>(null);

  const lineSubtotal = lines.reduce((sum, l) => {
    const q = Number.parseInt(l.orderQty, 10) || 0;
    const p = Number.parseFloat(l.unitPrice) || 0;
    return sum + q * p;
  }, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Delivery orders</h1>
        <p className="text-sm opacity-75">
          Create orders for delivery, then open a document to print or save as PDF from the browser.
        </p>
      </div>

      {customers.length === 0 || products.length === 0 ? (
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 text-sm">
          <div className="font-medium">Setup required</div>
          <ul className="list-disc pl-5 opacity-80 mt-2 space-y-1">
            {customers.length === 0 ? <li>Add at least one customer.</li> : null}
            {products.length === 0 ? <li>Add at least one product.</li> : null}
          </ul>
          <div className="mt-3 flex gap-3">
            <Link className="underline underline-offset-4" href="/customers">
              Customers
            </Link>
            <Link className="underline underline-offset-4" href="/products">
              Products
            </Link>
          </div>
        </div>
      ) : (
        <form action={createDeliveryOrderAction} className="space-y-6 rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">New delivery order</h2>

          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="dateIssued" value={dateIssued} />
          <input type="hidden" name="orderRef" value={orderRef} />
          <input type="hidden" name="collectionPoint" value={collectionPoint} />
          <input type="hidden" name="lines" value={JSON.stringify(lines)} />
          <input type="hidden" name="payments" value={JSON.stringify(payments)} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Customer</label>
              <select
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Date issued</label>
              <input
                type="date"
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                value={dateIssued}
                onChange={(e) => setDateIssued(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Customer reference (optional)</label>
              <input
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                value={orderRef}
                onChange={(e) => setOrderRef(e.target.value)}
                placeholder="PO / contract ref"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Collection point (optional)</label>
              <input
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                value={collectionPoint}
                onChange={(e) => setCollectionPoint(e.target.value)}
                placeholder="Warehouse / site"
              />
            </div>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Line items</h3>
              <button
                type="button"
                className="text-sm underline underline-offset-4"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    {
                      productId: String(products[0]?.productId ?? ""),
                      orderQty: "1",
                      orderUnit: "kg",
                      unitPrice: "",
                    },
                  ])
                }
              >
                Add line
              </button>
            </div>
            <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
                <div className="col-span-4">Product</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Unit</div>
                <div className="col-span-3">Unit price (XAF)</div>
                <div className="col-span-1" />
              </div>
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                  <div className="col-span-4">
                    <select
                      className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                      value={l.productId}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)),
                        )
                      }
                    >
                      {products.map((g) => (
                        <option key={g.productId} value={String(g.productId)}>
                          {g.productName} ({g.productCat.productCat})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                      inputMode="numeric"
                      value={l.orderQty}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, orderQty: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                      value={l.orderUnit}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, orderUnit: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                      inputMode="decimal"
                      value={l.unitPrice}
                      placeholder="Optional"
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)),
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
            <p className="text-xs opacity-70">
              Line subtotal (preview): {lineSubtotal.toFixed(2)} XAF — amounts are stored when unit price is set.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Payments (optional)</h3>
              <button
                type="button"
                className="text-sm underline underline-offset-4"
                onClick={() =>
                  setPayments((prev) => [
                    ...prev,
                    {
                      method: "CASH",
                      paymentDate: todayIsoDate(),
                      chequeNo: "",
                      bank: "",
                      cashReceiptNo: "",
                      receiptDate: "",
                    },
                  ])
                }
              >
                Add payment
              </button>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm opacity-70">No payments recorded on this order.</p>
            ) : (
              <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden space-y-0">
                {payments.map((p, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-3 py-3 border-b border-black/10 dark:border-white/10 last:border-b-0"
                  >
                    <div className="grid gap-1">
                      <label className="text-xs font-medium opacity-70">Method</label>
                      <select
                        className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm"
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
                    <div className="grid gap-1">
                      <label className="text-xs font-medium opacity-70">Payment date</label>
                      <input
                        type="date"
                        className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm"
                        value={p.paymentDate}
                        onChange={(e) =>
                          setPayments((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, paymentDate: e.target.value } : x)),
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-1 sm:col-span-2 lg:col-span-1">
                      <label className="text-xs font-medium opacity-70">Cheque / bank / receipt</label>
                      <div className="flex flex-col gap-1">
                        <input
                          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
                          placeholder="Cheque no."
                          value={p.chequeNo}
                          disabled={p.method !== "CHEQUE"}
                          onChange={(e) =>
                            setPayments((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, chequeNo: e.target.value } : x)),
                            )
                          }
                        />
                        <input
                          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
                          placeholder="Bank"
                          value={p.bank}
                          onChange={(e) =>
                            setPayments((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, bank: e.target.value } : x)),
                            )
                          }
                        />
                        <input
                          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
                          placeholder="Cash receipt no."
                          value={p.cashReceiptNo}
                          onChange={(e) =>
                            setPayments((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, cashReceiptNo: e.target.value } : x)),
                            )
                          }
                        />
                        <input
                          type="date"
                          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
                          placeholder="Receipt date"
                          value={p.receiptDate}
                          onChange={(e) =>
                            setPayments((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, receiptDate: e.target.value } : x)),
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                      <button
                        type="button"
                        className="text-xs underline underline-offset-4"
                        onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove payment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <button
            type="submit"
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium"
          >
            Save delivery order
          </button>
        </form>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Recent orders</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-2">No.</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-3">Customer</div>
            <div className="col-span-1">Lines</div>
            <div className="col-span-4 text-right">Actions</div>
          </div>
          {orders.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No delivery orders yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {orders.map((o) => (
                <li key={o.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                  <div className="col-span-2 font-medium tabular-nums">{o.deliveryOrderNo}</div>
                  <div className="col-span-2 opacity-80">{o.dateIssuedIso.slice(0, 10)}</div>
                  <div className="col-span-3 truncate">{o.customerName}</div>
                  <div className="col-span-1 tabular-nums">{o.lineCount}</div>
                  <div className="col-span-4 flex items-center justify-end gap-2">
                    <Link
                      href={`/delivery-orders/${o.id}`}
                      className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      View / print
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({ id: o.id, label: o.deliveryOrderNo })
                      }
                      className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this delivery order?"
          description={`“${pendingDelete.label}” and its lines will be removed. This cannot be undone.`}
          confirmLabel="Delete order"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("id", String(pendingDelete.id));
            await deleteDeliveryOrderAction(fd);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}
