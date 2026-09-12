import { ConflictError } from "@/lib/errors";

/**
 * Compatibility guard for the legacy endpoint. A successful receipt
 * represents money already received; reversing it must go through the refund
 * workflow so approval, settlement method and audit data are preserved.
 */
export async function cancelTuitionReceipt(
  _receiptId: string,
  _actorId: string,
  _reason: string,
): Promise<never> {
  throw new ConflictError(
    "Biên lai thanh toán thành công phải xử lý qua quy trình hoàn tiền",
  );
}
