import { loadStockBootstrap } from "./loaders";
import { StockClient } from "./StockClient";
import {
  cancelAdjustment,
  cancelReceipt,
  cancelTransfer,
  dispatchTransfer,
  findReceiptByNumber,
  findTransferByNumber,
  loadReceiptForReview,
  loadTransferForReview,
  postAdjustment,
  postReceipt,
  receiveTransfer,
  saveAdjustment,
  saveReceipt,
  saveTransfer,
} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StockPage() {
  const data = await loadStockBootstrap();

  return (
    <StockClient
      bootstrap={data}
      saveReceiptAction={saveReceipt}
      postReceiptAction={postReceipt}
      cancelReceiptAction={cancelReceipt}
      findReceiptByNumberAction={findReceiptByNumber}
      loadReceiptForReviewAction={loadReceiptForReview}
      saveTransferAction={saveTransfer}
      dispatchTransferAction={dispatchTransfer}
      receiveTransferAction={receiveTransfer}
      cancelTransferAction={cancelTransfer}
      findTransferByNumberAction={findTransferByNumber}
      loadTransferForReviewAction={loadTransferForReview}
      saveAdjustmentAction={saveAdjustment}
      postAdjustmentAction={postAdjustment}
      cancelAdjustmentAction={cancelAdjustment}
    />
  );
}
