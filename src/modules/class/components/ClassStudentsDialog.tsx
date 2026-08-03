"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import { StudentSelectDialog, type StudentItem } from "@/components/shared/dialogs/StudentSelectDialog";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type Enrollment = { id: string; studentId: string; status: string; enrolledAt: string; student: { id: string; code: string; fullName: string; phone?: string | null } };
type Props = { open: boolean; classId: string; className: string; canDelete: boolean; onClose: () => void };

export function ClassStudentsDialog({ open, classId, className, canDelete, onClose }: Props) {
  const [items, setItems] = useState<Enrollment[]>([]); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const load = useCallback(async () => { if (!open) return; setLoading(true); setError(""); try { const response = await fetch(`/api/classes/${classId}/students`); if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải danh sách học sinh")); setItems(await unwrapApiResponse<Enrollment[]>(response)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải danh sách học sinh"); } finally { setLoading(false); } }, [classId, open]);
  useEffect(() => { void load(); }, [load]);
  async function addStudent(student: StudentItem) { setBusy(true); setError(""); const response = await fetch(`/api/classes/${classId}/students`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: student.id }) }); if (!response.ok) setError(await extractApiErrorMessage(response, "Không thể đăng ký học sinh")); else { setStudentDialogOpen(false); await load(); } setBusy(false); }
  async function removeStudent(studentId: string) { setBusy(true); setError(""); const response = await fetch(`/api/classes/${classId}/students`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId }) }); if (!response.ok) setError(await extractApiErrorMessage(response, "Không thể xóa đăng ký")); else await load(); setBusy(false); }
  return <><Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md"><DialogTitle>Học sinh lớp {className}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>{error && <Alert severity="error">{error}</Alert>}<Button variant="contained" startIcon={<PersonAddAlt1Icon />} onClick={() => setStudentDialogOpen(true)} disabled={busy}>Đăng ký học sinh</Button>{loading ? <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack> : items.length ? <List>{items.map((item) => <ListItem key={item.id} divider secondaryAction={<Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => void removeStudent(item.studentId)} disabled={busy || !canDelete}>Xóa</Button>}><ListItemText primary={`${item.student.code} — ${item.student.fullName}`} secondary={`Đăng ký: ${new Date(item.enrolledAt).toLocaleDateString("vi-VN")} · ${item.status}`} /></ListItem>)}</List> : <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>Lớp chưa có học sinh</Typography>}</Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={busy}>Đóng</Button></DialogActions></Dialog><StudentSelectDialog open={studentDialogOpen} onClose={() => setStudentDialogOpen(false)} onSelect={(student) => void addStudent(student)} /></>;
}
