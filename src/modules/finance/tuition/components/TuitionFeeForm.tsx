"use client";

import { useMemo, useState } from "react";
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { CurrencyInput } from "@/components/shared/forms/CurrencyInput";
import { MasterSelectField, type MasterSelectValue } from "@/components/shared/forms/MasterSelectField";
import { StudentSelectDialog, type StudentItem } from "@/components/shared/dialogs/StudentSelectDialog";
import { ClassSelectDialog, type ClassItem } from "@/components/shared/dialogs/ClassSelectDialog";
import { useDisclosure } from "@/hooks/useDisclosure";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type Item = { itemType: "TUITION" | "MATERIAL" | "UNIFORM" | "EXAM_FEE" | "OTHER_FEE" | "DISCOUNT" | "SCHOLARSHIP"; itemName: string; quantity: number; unitPrice: number; amount: number; displayOrder: number };
const types = [{ value: "TUITION", label: "Học phí khóa học" }, { value: "MATERIAL", label: "Giáo trình" }, { value: "UNIFORM", label: "Đồng phục" }, { value: "EXAM_FEE", label: "Lệ phí thi" }, { value: "OTHER_FEE", label: "Phụ phí khác" }];

export function TuitionFeeForm({ onSuccess }: { onSuccess?: (id: string) => void }) {
  const studentDialog = useDisclosure();
  const classDialog = useDisclosure();
  const [student, setStudent] = useState<MasterSelectValue | null>(null);
  const [selectedClass, setSelectedClass] = useState<MasterSelectValue | null>(null);
  const [studentId, setStudentId] = useState(""); const [classId, setClassId] = useState(""); const [enrollmentId, setEnrollmentId] = useState(""); const [classTuitionFee, setClassTuitionFee] = useState(0);
  const [dueDate, setDueDate] = useState(""); const [discount, setDiscount] = useState(0); const [additional, setAdditional] = useState(0); const [note, setNote] = useState("");
  const [items, setItems] = useState<Item[]>([{ itemType: "TUITION", itemName: "Học phí khóa học", quantity: 1, unitPrice: 0, amount: 0, displayOrder: 0 }]); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const originalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]); const finalAmount = originalAmount - discount + additional;
  function updateItem(index: number, field: keyof Item, value: string | number) { setItems((current) => current.map((item, itemIndex) => { if (itemIndex !== index) return item; const next = { ...item, [field]: value }; if (field === "quantity" || field === "unitPrice") next.amount = Number(next.quantity) * Number(next.unitPrice); return next; })); }
  async function selectStudent(item: StudentItem) { setStudent({ id: item.id, code: item.code, name: item.fullName }); setStudentId(item.id); setEnrollmentId(""); studentDialog.onClose(); if (classId) { const response = await fetch(`/api/classes/${classId}/students`); if (response.ok) { const enrolled = await unwrapApiResponse<Array<{ id: string; studentId: string }>>(response); setEnrollmentId(enrolled.find((entry) => entry.studentId === item.id)?.id || ""); } } }
  async function selectClass(item: ClassItem) { const tuitionFee = Number(item.tuitionFee || 0); setSelectedClass({ id: item.id, code: item.code, name: item.name }); setClassId(item.id); setClassTuitionFee(tuitionFee); setItems((current) => current.map((feeItem, index) => index === 0 ? { ...feeItem, unitPrice: tuitionFee, amount: tuitionFee } : feeItem)); setEnrollmentId(""); classDialog.onClose(); if (!studentId) return; const response = await fetch(`/api/classes/${item.id}/students`); if (response.ok) { const enrolled = await unwrapApiResponse<Array<{ id: string; studentId: string }>>(response); setEnrollmentId(enrolled.find((entry) => entry.studentId === studentId)?.id || ""); } }
  async function submit() { if (!studentId || !classId || !enrollmentId || !items.length || finalAmount < 0) { setError("Hãy chọn học viên, lớp có đăng ký và kiểm tra tổng tiền"); return; } setSaving(true); setError(""); try { const response = await fetch("/api/tuition-fees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, enrollmentId, classId, originalAmount, discountAmount: discount, additionalAmount: additional, dueDate: dueDate || undefined, note: note || undefined, items }) }); if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo học phí")); const result = await unwrapApiResponse<{ id: string }>(response); onSuccess?.(result.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tạo học phí"); } finally { setSaving(false); } }
  return <Stack spacing={2} width="100%">
    <Typography variant="h5" fontWeight={700}>Tạo học phí</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <Paper sx={{ p: 2 }}><Stack spacing={2}>
      <Alert severity="info">Mã học phí sẽ được hệ thống tự động tạo khi đăng ký.</Alert>
      <MasterSelectField label="Học viên" value={student} onOpen={studentDialog.onOpen} required codeLabel="Mã học sinh" nameLabel="Họ tên" />
      <MasterSelectField label="Lớp học" value={selectedClass} onOpen={classDialog.onOpen} required codeLabel="Mã lớp" nameLabel="Tên lớp" />
      <CurrencyInput label="Học phí theo lớp" value={classTuitionFee} readOnly helperText={classTuitionFee > 0 ? "Tự động lấy từ cấu hình của lớp" : "Lớp chưa cấu hình học phí"} />
      <Typography variant="body2" color={student && selectedClass && !enrollmentId ? "error" : "text.secondary"}>{student && selectedClass && !enrollmentId ? "Học viên chưa đăng ký lớp này hoặc chưa tải được đăng ký." : "Chọn học viên và lớp đã đăng ký để tạo học phí."}</Typography>
      <TextField type="date" label="Hạn thanh toán" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} />
    </Stack></Paper>
    <Paper sx={{ p: 2 }}><Typography variant="h6" sx={{ mb: 1 }}>Các khoản phí</Typography>{items.map((item, index) => <Stack key={index} direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1 }}><TextField select label="Loại" value={item.itemType} onChange={(e) => updateItem(index, "itemType", e.target.value)} sx={{ minWidth: 180 }}>{types.map((type) => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}</TextField><TextField label="Tên khoản" value={item.itemName} onChange={(e) => updateItem(index, "itemName", e.target.value)} /><TextField label="Số lượng" type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", Number(e.target.value))} /><CurrencyInput label="Đơn giá" value={item.unitPrice} onChange={(value) => updateItem(index, "unitPrice", value)} /><CurrencyInput label="Thành tiền" value={item.amount} readOnly /></Stack>)}<Button onClick={() => setItems((current) => [...current, { itemType: "OTHER_FEE", itemName: "", quantity: 1, unitPrice: 0, amount: 0, displayOrder: current.length }])}>Thêm khoản phí</Button></Paper>
    <Paper sx={{ p: 2 }}><Stack spacing={1}><CurrencyInput label="Học phí gốc" value={originalAmount} readOnly /><CurrencyInput label="Giảm giá / học bổng" value={discount} onChange={setDiscount} /><CurrencyInput label="Phụ phí" value={additional} onChange={setAdditional} /><Typography variant="h6">Tổng phải thanh toán: {new Intl.NumberFormat("vi-VN").format(finalAmount)} VND</Typography><TextField label="Ghi chú" multiline minRows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Stack></Paper>
    <Button variant="contained" onClick={() => void submit()} disabled={saving}>{saving ? "Đang lưu..." : "Tạo học phí"}</Button>
    <StudentSelectDialog open={studentDialog.open} onClose={studentDialog.onClose} onSelect={selectStudent} />
    <ClassSelectDialog open={classDialog.open} onClose={classDialog.onClose} onSelect={(item) => void selectClass(item)} />
  </Stack>;
}
