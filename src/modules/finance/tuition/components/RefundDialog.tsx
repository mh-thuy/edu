"use client";

import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { extractApiErrorMessage } from "@/lib/api-client";

export function RefundDialog({ paymentId, amount, onClose, onSuccess }: { paymentId: string; amount: number; onClose: () => void; onSuccess: () => void }) {
  const [method, setMethod] = useState("BANK_TRANSFER"); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit() { if (!reason.trim()) { setError("Lý do hoàn tiền là bắt buộc"); return; } setSaving(true); const response = await fetch("/api/tuition-refunds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId, refundMethod: method, reason }) }); if (!response.ok) setError(await extractApiErrorMessage(response, "Không thể hoàn tiền")); else onSuccess(); setSaving(false); }
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Hoàn tiền toàn bộ</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>{error && <Alert severity="error">{error}</Alert>}<Typography>Chỉ hỗ trợ hoàn toàn bộ: <strong>{Number(amount).toLocaleString("vi-VN")} VND</strong></Typography><TextField select label="Phương thức hoàn" value={method} onChange={(e) => setMethod(e.target.value)}><MenuItem value="BANK_TRANSFER">Chuyển khoản</MenuItem><MenuItem value="CASH">Tiền mặt</MenuItem><MenuItem value="OTHER">Khác</MenuItem></TextField><TextField label="Lý do hoàn tiền *" multiline minRows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Quay lại</Button><Button color="error" variant="contained" onClick={() => void submit()} disabled={saving}>{saving ? "Đang xử lý..." : "Xác nhận hoàn toàn bộ"}</Button></DialogActions></Dialog>;
}
