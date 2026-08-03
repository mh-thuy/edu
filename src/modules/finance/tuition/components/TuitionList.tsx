"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Chip, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import Link from "next/link";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { MasterSelectField, type MasterSelectValue } from "@/components/shared/forms/MasterSelectField";
import { StudentSelectDialog, type StudentItem } from "@/components/shared/dialogs/StudentSelectDialog";
import { ClassSelectDialog, type ClassItem } from "@/components/shared/dialogs/ClassSelectDialog";
import { useDisclosure } from "@/hooks/useDisclosure";

type Status = "UNPAID" | "PAID" | "OVERDUE" | "EXEMPTED" | "CANCELLED";
type Fee = { id: string; feeNo: string; originalAmount: number; discountAmount: number; additionalAmount: number; finalAmount: number; dueDate?: string | null; status: Status; createdAt: string; student?: { code: string; fullName: string } | null; class?: { name: string } | null; payments?: Array<{ paymentDate: string; paymentMethod: string }> };

const labels: Record<Status, string> = { UNPAID: "Chưa thanh toán", PAID: "Đã thanh toán", OVERDUE: "Quá hạn", EXEMPTED: "Miễn học phí", CANCELLED: "Đã hủy" };
const colors: Record<Status, "default" | "success" | "warning" | "info" | "error"> = { UNPAID: "warning", PAID: "success", OVERDUE: "error", EXEMPTED: "info", CANCELLED: "default" };
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(Number(value))} VND`;

export function TuitionList() {
  const [items, setItems] = useState<Fee[]>([]);
  const [studentCode, setStudentCode] = useState("");
  const [student, setStudent] = useState<MasterSelectValue | null>(null);
  const [selectedClass, setSelectedClass] = useState<MasterSelectValue | null>(null);
  const [classId, setClassId] = useState("");
  const studentDialog = useDisclosure();
  const classDialog = useDisclosure();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const query = new URLSearchParams({ pageSize: "200" });
    if (studentCode.trim()) query.set("studentCode", studentCode.trim());
    if (classId) query.set("classId", classId);
    if (status) query.set("status", status);
    try {
      const response = await fetch(`/api/tuition-fees?${query}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải danh sách học phí"));
      setItems((await unwrapApiResponse<{ items: Fee[] }>(response)).items);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải danh sách học phí"); }
    finally { setLoading(false); }
  }, [studentCode, classId, status]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() { setExporting(true); const query = new URLSearchParams({ export: "csv" }); if (studentCode.trim()) query.set("studentCode", studentCode.trim()); if (classId) query.set("classId", classId); if (status) query.set("status", status); try { const response = await fetch(`/api/tuition-fees?${query}`); if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể xuất danh sách học phí")); const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "tuition-fees.csv"; anchor.click(); URL.revokeObjectURL(url); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xuất danh sách học phí"); } finally { setExporting(false); } }

  return <Stack spacing={2}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
      <BoxTitle />
      <Stack direction="row" spacing={1}><Button component={Link} href="/admin/tuition-fees/new" variant="contained" startIcon={<AddIcon />}>Tạo học phí</Button><Button variant="outlined" onClick={() => void exportCsv()} disabled={exporting}>{exporting ? "Đang xuất..." : "Xuất CSV"}</Button><Button variant="outlined" onClick={() => void load()}>Làm mới</Button></Stack>
    </Stack>
    <Paper sx={{ p: 2 }}><Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center">
      <MasterSelectField label="Học viên" value={student} onOpen={studentDialog.onOpen} size="small" codeLabel="Mã học sinh" nameLabel="Họ tên" sx={{ flex: 1, minWidth: 260 }} />
      <MasterSelectField label="Lớp học" value={selectedClass} onOpen={classDialog.onOpen} size="small" codeLabel="Mã lớp" nameLabel="Tên lớp" sx={{ flex: 1, minWidth: 260 }} />
      <Select size="small" displayEmpty value={status} onChange={(event) => setStatus(event.target.value)} sx={{ minWidth: 190 }}><MenuItem value="">Tất cả trạng thái</MenuItem>{(Object.keys(labels) as Status[]).map((key) => <MenuItem key={key} value={key}>{labels[key]}</MenuItem>)}</Select>
      <Button variant="contained" onClick={() => void load()}>Tìm kiếm</Button>
    </Stack></Paper>
    {error && <Alert severity="error">{error}</Alert>}
    <Paper sx={{ overflow: "auto" }}><Table size="small"><TableHead><TableRow><TableCell>Mã học phí</TableCell><TableCell>Học sinh</TableCell><TableCell>Lớp</TableCell><TableCell>Học phí gốc</TableCell><TableCell>Giảm giá</TableCell><TableCell>Phụ phí</TableCell><TableCell align="right">Tổng phải thu</TableCell><TableCell>Hạn thanh toán</TableCell><TableCell>Trạng thái</TableCell></TableRow></TableHead><TableBody>
      {!loading && items.map((item) => <TableRow key={item.id} hover><TableCell><Button component={Link} href={`/admin/tuition-fees/${item.id}`} size="small">{item.feeNo}</Button></TableCell><TableCell>{item.student?.code}<br /><Typography variant="caption">{item.student?.fullName}</Typography></TableCell><TableCell>{item.class?.name || "-"}</TableCell><TableCell>{money(item.originalAmount)}</TableCell><TableCell>{money(item.discountAmount)}</TableCell><TableCell>{money(item.additionalAmount)}</TableCell><TableCell align="right"><strong>{money(item.finalAmount)}</strong></TableCell><TableCell>{item.dueDate ? new Date(item.dueDate).toLocaleDateString("vi-VN") : "-"}</TableCell><TableCell><Chip size="small" color={colors[item.status]} label={labels[item.status]} /></TableCell></TableRow>)}
      {!loading && !items.length && <TableRow><TableCell colSpan={9}><Typography sx={{ p: 4, textAlign: "center" }} color="text.secondary">Không có học phí phù hợp</Typography></TableCell></TableRow>}
      {loading && <TableRow><TableCell colSpan={9}><Typography sx={{ p: 4, textAlign: "center" }}>Đang tải dữ liệu...</Typography></TableCell></TableRow>}
    </TableBody></Table></Paper>
    <StudentSelectDialog open={studentDialog.open} onClose={studentDialog.onClose} onSelect={(item: StudentItem) => { setStudent({ id: item.id, code: item.code, name: item.fullName }); setStudentCode(item.code); studentDialog.onClose(); }} />
    <ClassSelectDialog open={classDialog.open} onClose={classDialog.onClose} onSelect={(item: ClassItem) => { setSelectedClass({ id: item.id, code: item.code, name: item.name }); setClassId(item.id); classDialog.onClose(); }} />
  </Stack>;
}

function BoxTitle() { return <Stack><Typography variant="h5" fontWeight={700}>Danh sách học phí</Typography><Typography variant="body2" color="text.secondary">Theo dõi từng khoản học phí và thanh toán toàn bộ một lần</Typography></Stack>; }
