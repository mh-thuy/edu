export type ReconciliationRowAction = {
  label: string;
  variant: "contained" | "text";
  color: "primary" | "success";
};

export function getReconciliationRowAction(status: string): ReconciliationRowAction {
  if (status === "UNMATCHED") return { label: "Chọn đợt", variant: "contained", color: "primary" };
  if (status === "AUTO_MATCHED") return { label: "Xác nhận", variant: "contained", color: "success" };
  return { label: "Chi tiết", variant: "text", color: "primary" };
}
