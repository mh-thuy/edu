"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import { useForm } from "react-hook-form";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { useSnackbar } from "@/hooks/useSnackbar";

type Account = { id: string; bankCode: string; bankName: string; accountNo: string; accountName: string; branchName?: string | null; currencyCode: string; isActive: boolean };
type FormValues = { bankCode: string; bankName: string; accountNo: string; accountName: string; branchName: string; currencyCode: string };
const emptyValues: FormValues = { bankCode: "", bankName: "", accountNo: "", accountName: "", branchName: "", currencyCode: "VND" };

export function BankAccountManagement() {
  const [items, setItems] = useState<Account[]>([]);
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState("");
  const { showSuccess, showError, Snackbar } = useSnackbar();
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`/api/bank-accounts?includeInactive=${showInactive}`); if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải tài khoản ngân hàng")); setItems(await unwrapApiResponse<Account[]>(response)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải tài khoản ngân hàng"); } finally { setLoading(false); } }, [showInactive]);
  useEffect(() => { void load(); }, [load]);
  function startCreate() { setEditing(null); setDialogError(""); setOpen(true); }
  function startEdit(item: Account) { setEditing(item); setDialogError(""); setOpen(true); }
  async function toggle(item: Account) {
    setTogglingId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/bank-accounts/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }) });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể cập nhật trạng thái tài khoản"));
      await load();
      showSuccess(item.isActive ? "Đã ngưng sử dụng tài khoản" : "Đã kích hoạt tài khoản");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể cập nhật trạng thái tài khoản";
      setError(message);
      showError(message);
    } finally {
      setTogglingId(null);
    }
  }
  async function save(values: FormValues) {
    setSaving(true);
    setDialogError("");
    setError("");
    try {
      const response = await fetch(editing ? `/api/bank-accounts/${editing.id}` : "/api/bank-accounts", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể lưu tài khoản ngân hàng"));
      setOpen(false);
      await load();
      showSuccess(editing ? "Đã cập nhật tài khoản ngân hàng" : "Đã lưu tài khoản ngân hàng");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể lưu tài khoản ngân hàng";
      setDialogError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  }
  return <Stack spacing={{ xs: 2, md: 3 }}><Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={2}><BoxTitle /><Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>Thêm tài khoản</Button></Stack></Paper>{error && <Alert severity="error">{error}</Alert>}<Paper sx={{ p: { xs: 2, md: 2.5 } }}><Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between"><Typography variant="subtitle2">Tài khoản sử dụng cho thu học phí</Typography><Stack direction="row" alignItems="center"><Switch checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /><Typography variant="body2">Hiển thị tài khoản đã ngưng sử dụng</Typography></Stack></Stack></Paper><Paper sx={{ overflow: "auto" }}><Table size="small"><TableHead><TableRow><TableCell>Ngân hàng</TableCell><TableCell>Số tài khoản</TableCell><TableCell>Chủ tài khoản</TableCell><TableCell>Chi nhánh</TableCell><TableCell>Tiền tệ</TableCell><TableCell>Trạng thái</TableCell><TableCell /></TableRow></TableHead><TableBody>{!loading && items.map((item) => <TableRow key={item.id}><TableCell>{item.bankName}<br /><Typography variant="caption" color="text.secondary">{item.bankCode}</Typography></TableCell><TableCell>{item.accountNo}</TableCell><TableCell>{item.accountName}</TableCell><TableCell>{item.branchName || "-"}</TableCell><TableCell>{item.currencyCode}</TableCell><TableCell><Chip size="small" color={item.isActive ? "success" : "default"} label={item.isActive ? "Đang dùng" : "Đã ngưng"} /></TableCell><TableCell><Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => startEdit(item)}>Sửa</Button><Button size="small" variant="outlined" color={item.isActive ? "warning" : "success"} disabled={togglingId === item.id} onClick={() => void toggle(item)}>{togglingId === item.id ? "Đang cập nhật..." : item.isActive ? "Ngưng dùng" : "Kích hoạt"}</Button></TableCell></TableRow>)}{!loading && !items.length && <TableRow><TableCell colSpan={7}><Typography sx={{ p: 4 }} textAlign="center" color="text.secondary">Chưa có tài khoản ngân hàng</Typography></TableCell></TableRow>}{loading && <TableRow><TableCell colSpan={7}><Typography sx={{ p: 4 }} textAlign="center">Đang tải...</Typography></TableCell></TableRow>}</TableBody></Table></Paper><AccountDialog open={open} editing={editing} saving={saving} error={dialogError} onClose={() => { setDialogError(""); setOpen(false); }} onSave={save} />{Snackbar}</Stack>;
}

function AccountDialog({ open, editing, saving, error, onClose, onSave }: { open: boolean; editing: Account | null; saving: boolean; error: string; onClose: () => void; onSave: (values: FormValues) => Promise<void> }) {
  const form = useForm<FormValues>({ defaultValues: emptyValues });
  useEffect(() => { form.reset(editing ? { bankCode: editing.bankCode, bankName: editing.bankName, accountNo: editing.accountNo, accountName: editing.accountName, branchName: editing.branchName || "", currencyCode: editing.currencyCode } : emptyValues); }, [editing, form, open]);
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Sửa tài khoản nhận chuyển khoản" : "Thêm tài khoản nhận chuyển khoản"}</DialogTitle><form onSubmit={form.handleSubmit(onSave)}><DialogContent dividers>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<Stack spacing={2}><AppTextField fullWidth label="Mã ngân hàng" {...form.register("bankCode", { required: "Mã ngân hàng là bắt buộc" })} error={!!form.formState.errors.bankCode} helperText={form.formState.errors.bankCode?.message} /><AppTextField fullWidth label="Tên ngân hàng" {...form.register("bankName", { required: "Tên ngân hàng là bắt buộc" })} error={!!form.formState.errors.bankName} helperText={form.formState.errors.bankName?.message} /><AppTextField fullWidth label="Số tài khoản" {...form.register("accountNo", { required: "Số tài khoản là bắt buộc" })} error={!!form.formState.errors.accountNo} helperText={form.formState.errors.accountNo?.message} /><AppTextField fullWidth label="Tên chủ tài khoản" {...form.register("accountName", { required: "Tên chủ tài khoản là bắt buộc" })} error={!!form.formState.errors.accountName} helperText={form.formState.errors.accountName?.message} /><AppTextField fullWidth label="Chi nhánh" {...form.register("branchName")} /><AppTextField fullWidth label="Loại tiền" {...form.register("currencyCode", { required: "Loại tiền là bắt buộc" })} error={!!form.formState.errors.currencyCode} helperText={form.formState.errors.currencyCode?.message} /></Stack></DialogContent><DialogActions><Button variant="outlined" onClick={onClose} disabled={saving}>Hủy</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button></DialogActions></form></Dialog>;
}

function BoxTitle() { return <Stack direction="row" spacing={1.5} alignItems="center"><Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}><AccountBalanceOutlinedIcon /></Box><Stack><Typography variant="h5" fontWeight={700}>Tài khoản nhận chuyển khoản</Typography><Typography variant="body2" color="text.secondary">Quản lý tài khoản ngân hàng dùng để nhận học phí.</Typography></Stack></Stack>; }
