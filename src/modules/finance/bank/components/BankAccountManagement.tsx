"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useForm } from "react-hook-form";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

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
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`/api/bank-accounts?includeInactive=${showInactive}`); if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải tài khoản ngân hàng")); setItems(await unwrapApiResponse<Account[]>(response)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải tài khoản ngân hàng"); } finally { setLoading(false); } }, [showInactive]);
  useEffect(() => { void load(); }, [load]);
  function startCreate() { setEditing(null); setOpen(true); }
  function startEdit(item: Account) { setEditing(item); setOpen(true); }
  async function toggle(item: Account) { setError(""); const response = await fetch(`/api/bank-accounts/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }) }); if (!response.ok) setError(await extractApiErrorMessage(response, "Không thể cập nhật trạng thái tài khoản")); else void load(); }
  async function save(values: FormValues) { setSaving(true); setError(""); const response = await fetch(editing ? `/api/bank-accounts/${editing.id}` : "/api/bank-accounts", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }); if (!response.ok) setError(await extractApiErrorMessage(response, "Không thể lưu tài khoản ngân hàng")); else { setOpen(false); void load(); } setSaving(false); }
  return <Stack spacing={2}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}><BoxTitle /><Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>Thêm tài khoản</Button></Stack>{error && <Alert severity="error">{error}</Alert>}<Paper sx={{ p: 2 }}><Stack direction="row" alignItems="center"><Switch checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /><Typography>Hiển thị tài khoản đã ngưng sử dụng</Typography></Stack></Paper><Paper sx={{ overflow: "auto" }}><Table size="small"><TableHead><TableRow><TableCell>Ngân hàng</TableCell><TableCell>Số tài khoản</TableCell><TableCell>Chủ tài khoản</TableCell><TableCell>Chi nhánh</TableCell><TableCell>Tiền tệ</TableCell><TableCell>Trạng thái</TableCell><TableCell /></TableRow></TableHead><TableBody>{!loading && items.map((item) => <TableRow key={item.id}><TableCell>{item.bankName}<br /><Typography variant="caption" color="text.secondary">{item.bankCode}</Typography></TableCell><TableCell>{item.accountNo}</TableCell><TableCell>{item.accountName}</TableCell><TableCell>{item.branchName || "-"}</TableCell><TableCell>{item.currencyCode}</TableCell><TableCell><Chip size="small" color={item.isActive ? "success" : "default"} label={item.isActive ? "Đang dùng" : "Đã ngưng"} /></TableCell><TableCell><Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => startEdit(item)}>Sửa</Button><Button size="small" onClick={() => void toggle(item)}>{item.isActive ? "Ngưng dùng" : "Kích hoạt"}</Button></TableCell></TableRow>)}{!loading && !items.length && <TableRow><TableCell colSpan={7}><Typography sx={{ p: 4 }} textAlign="center" color="text.secondary">Chưa có tài khoản ngân hàng</Typography></TableCell></TableRow>}{loading && <TableRow><TableCell colSpan={7}><Typography sx={{ p: 4 }} textAlign="center">Đang tải...</Typography></TableCell></TableRow>}</TableBody></Table></Paper><AccountDialog open={open} editing={editing} saving={saving} onClose={() => setOpen(false)} onSave={save} /></Stack>;
}

function AccountDialog({ open, editing, saving, onClose, onSave }: { open: boolean; editing: Account | null; saving: boolean; onClose: () => void; onSave: (values: FormValues) => Promise<void> }) {
  const form = useForm<FormValues>({ defaultValues: emptyValues });
  useEffect(() => { form.reset(editing ? { bankCode: editing.bankCode, bankName: editing.bankName, accountNo: editing.accountNo, accountName: editing.accountName, branchName: editing.branchName || "", currencyCode: editing.currencyCode } : emptyValues); }, [editing, form, open]);
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Sửa tài khoản nhận chuyển khoản" : "Thêm tài khoản nhận chuyển khoản"}</DialogTitle><form onSubmit={form.handleSubmit(onSave)}><DialogContent dividers><Stack spacing={2}><TextField label="Mã ngân hàng" {...form.register("bankCode", { required: "Mã ngân hàng là bắt buộc" })} error={!!form.formState.errors.bankCode} helperText={form.formState.errors.bankCode?.message} /><TextField label="Tên ngân hàng" {...form.register("bankName", { required: "Tên ngân hàng là bắt buộc" })} error={!!form.formState.errors.bankName} helperText={form.formState.errors.bankName?.message} /><TextField label="Số tài khoản" {...form.register("accountNo", { required: "Số tài khoản là bắt buộc" })} error={!!form.formState.errors.accountNo} helperText={form.formState.errors.accountNo?.message} /><TextField label="Tên chủ tài khoản" {...form.register("accountName", { required: "Tên chủ tài khoản là bắt buộc" })} error={!!form.formState.errors.accountName} helperText={form.formState.errors.accountName?.message} /><TextField label="Chi nhánh" {...form.register("branchName")} /><TextField label="Loại tiền" {...form.register("currencyCode", { required: "Loại tiền là bắt buộc" })} /></Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={saving}>Hủy</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button></DialogActions></form></Dialog>;
}

function BoxTitle() { return <Stack><Typography variant="h5" fontWeight={700}>Tài khoản nhận chuyển khoản</Typography><Typography variant="body2" color="text.secondary">Quản lý tài khoản ngân hàng dùng để nhận học phí</Typography></Stack>; }
