// Quy tắc sửa số tiền học phí, dùng chung cho server (updateFee) và màn hình lớp.
// Trả về lý do không cho sửa, hoặc null nếu được phép sửa.
export function getTuitionFeeAmountEditBlock(fee: {
  status: string;
  paymentCount: number;
  pendingBatchNo?: string | null;
}): string | null {
  if (fee.status !== "UNPAID" && fee.status !== "OVERDUE")
    return "Chỉ có thể sửa khoản học phí chưa thu hoặc quá hạn";
  if (fee.paymentCount > 0) return "Không thể sửa khoản học phí đã thanh toán";
  if (fee.pendingBatchNo)
    return `Không thể sửa khoản học phí đang chờ thanh toán trong đợt ${fee.pendingBatchNo}`;
  return null;
}
