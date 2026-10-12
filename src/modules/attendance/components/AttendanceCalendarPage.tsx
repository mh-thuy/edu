"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Drawer, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import ArrowBackIosNewOutlinedIcon from "@mui/icons-material/ArrowBackIosNewOutlined";
import ArrowForwardIosOutlinedIcon from "@mui/icons-material/ArrowForwardIosOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/feedback/LoadingState";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { AttendanceRecordList, type AttendanceRow } from "@/modules/attendance/components/AttendanceRecordList";

type ClassOption = { classId: string; classCode: string; className: string; classStatus: "ACTIVE" | "COMPLETED"; subjectName: string; teacherName: string; canCreate: boolean };
type SessionSummary = { id: string; sessionAt: string; updatedAt: string; studentCount: number };
type AttendanceSession = { id: string; sessionAt: string; updatedAt: string; class: { id: string; code: string; name: string; subjectName: string; teacherName: string }; records: AttendanceRow[]; audits: { id: string; action: string; performedAt: string; actor: { fullName: string } }[] };
type PageResult<T> = { items: T[]; pagination: { page: number; pageSize: number; totalPages: number } };
const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function vietnamDateKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (name: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === name)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
}
function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(Date.UTC(year, month, 1, 12)));
}
function currentVietnamMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { year, month: month - 1 };
}

export function AttendanceCalendarPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [shownMonth, setShownMonth] = useState(currentVietnamMonth);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const monthRequestId = useRef(0);

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const response = await fetch("/api/attendance?page=1&pageSize=100");
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không tải được danh sách lớp"));
      const first = await unwrapApiResponse<PageResult<ClassOption>>(response);
      const rest = await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, async (_, index) => {
        const next = await fetch("/api/attendance?page=" + (index + 2) + "&pageSize=100");
        if (!next.ok) throw new Error(await extractApiErrorMessage(next, "Không tải được danh sách lớp"));
        return unwrapApiResponse<PageResult<ClassOption>>(next);
      }));
      const items = [...first.items, ...rest.flatMap((page) => page.items)];
      setClasses(items);
      const firstClass = items[0];
      if (firstClass) setClassId((current) => current || firstClass.classId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được danh sách lớp"); }
    finally { setLoadingClasses(false); }
  }, []);
  useEffect(() => { void loadClasses(); }, [loadClasses]);

  const loadMonthSessions = useCallback(async () => {
    const requestId = ++monthRequestId.current;
    if (!classId) { setSessions([]); setLoadingSessions(false); return; }
    setLoadingSessions(true); setError("");
    try {
      const start = shownMonth.year + "-" + String(shownMonth.month + 1).padStart(2, "0") + "-01";
      const lastDay = new Date(shownMonth.year, shownMonth.month + 1, 0).getDate();
      const end = shownMonth.year + "-" + String(shownMonth.month + 1).padStart(2, "0") + "-" + String(lastDay).padStart(2, "0");
      const query = "classId=" + classId + "&fromDate=" + start + "&toDate=" + end + "&pageSize=100";
      const response = await fetch("/api/attendance?" + query + "&page=1");
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không tải được lịch sử điểm danh"));
      const first = await unwrapApiResponse<PageResult<SessionSummary>>(response);
      const rest = await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, async (_, index) => {
        const next = await fetch("/api/attendance?" + query + "&page=" + (index + 2));
        if (!next.ok) throw new Error(await extractApiErrorMessage(next, "Không tải được lịch sử điểm danh"));
        return unwrapApiResponse<PageResult<SessionSummary>>(next);
      }));
      const all = [...first.items, ...rest.flatMap((page) => page.items)];
      if (requestId === monthRequestId.current) setSessions(all);
    } catch (reason) {
      if (requestId === monthRequestId.current) { setError(reason instanceof Error ? reason.message : "Không tải được lịch sử điểm danh"); setSessions([]); }
    } finally { if (requestId === monthRequestId.current) setLoadingSessions(false); }
  }, [classId, shownMonth]);
  useEffect(() => { void loadMonthSessions(); }, [loadMonthSessions]);

  const days = useMemo(() => {
    const offset = (new Date(Date.UTC(shownMonth.year, shownMonth.month, 1)).getUTCDay() + 6) % 7;
    const monthLength = new Date(Date.UTC(shownMonth.year, shownMonth.month + 1, 0)).getUTCDate();
    const total = Math.ceil((offset + monthLength) / 7) * 7;
    return Array.from({ length: total }, (_, index) => {
      const day = index - offset + 1;
      return day < 1 || day > monthLength ? null : shownMonth.year + "-" + String(shownMonth.month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    });
  }, [shownMonth]);
  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, SessionSummary[]>();
    sessions.forEach((item) => { const key = vietnamDateKey(item.sessionAt); grouped.set(key, [...(grouped.get(key) ?? []), item]); });
    return grouped;
  }, [sessions]);
  const selectedDaySessions = sessionsByDate.get(selectedDate) ?? [];

  const openSession = async (id: string) => {
    setSession(null); setLoadingDetail(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/attendance?sessionId=" + id);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không tải được phiên điểm danh"));
      setSession(await unwrapApiResponse<AttendanceSession>(response));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được phiên điểm danh"); }
    finally { setLoadingDetail(false); }
  };
  const changeRecord = (enrollmentId: string, changes: Partial<Pick<AttendanceRow, "status" | "note">>) => {
    setSession((current) => current ? { ...current, records: current.records.map((row) => row.enrollmentId === enrollmentId ? { ...row, ...changes } : row) } : current);
  };
  const save = async () => {
    if (!session) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/attendance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id, records: session.records.map(({ enrollmentId, status, note }) => ({ enrollmentId, status, note })) }) });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể cập nhật điểm danh"));
      await openSession(session.id);
      await loadMonthSessions();
      setMessage("Đã cập nhật điểm danh");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật điểm danh"); }
    finally { setSaving(false); }
  };
  const moveMonth = (delta: number) => setShownMonth((current) => { const next = new Date(Date.UTC(current.year, current.month + delta, 1)); return { year: next.getUTCFullYear(), month: next.getUTCMonth() }; });

  return <Stack spacing={2.5}>
    <PageHeader title="Lịch điểm danh" description="Chọn ngày để xem hoặc chỉnh sửa các phiên đã lưu." />
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
      <Button component={Link} href="/teacher/attendance" variant="outlined" startIcon={<ArrowBackOutlinedIcon />} fullWidth sx={{ maxWidth: { sm: 240 }, minHeight: 44 }}>Quay lại điểm danh</Button>
      <FormControl fullWidth sx={{ maxWidth: { sm: 440 } }} disabled={loadingClasses}>
        <InputLabel id="attendance-calendar-class-label">Lớp</InputLabel>
        <Select id="attendance-calendar-class" name="classId" labelId="attendance-calendar-class-label" label="Lớp" value={classId} onChange={(event) => { setClassId(event.target.value); setSelectedDate(""); setSession(null); }}>{classes.map((item) => <MenuItem key={item.classId} value={item.classId}>{item.classCode} – {item.className} · {item.subjectName}</MenuItem>)}</Select>
      </FormControl>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {message && !selectedDate && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}
    <Paper sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <IconButton aria-label="Tháng trước" onClick={() => moveMonth(-1)}><ArrowBackIosNewOutlinedIcon fontSize="small" /></IconButton>
        <Typography variant="h6" textTransform="capitalize" fontWeight={700}>{monthLabel(shownMonth.year, shownMonth.month)}</Typography>
        <IconButton aria-label="Tháng sau" onClick={() => moveMonth(1)}><ArrowForwardIosOutlinedIcon fontSize="small" /></IconButton>
      </Stack>
      {loadingSessions && <LoadingState label="Đang tải lịch điểm danh..." minHeight={120} />}
      {!loadingSessions && <Box role="grid" aria-label={"Lịch điểm danh " + monthLabel(shownMonth.year, shownMonth.month)} sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: { xs: 0.25, sm: 0.75 } }}>
        {weekdays.map((day) => <Typography key={day} role="columnheader" variant="caption" fontWeight={700} color="text.secondary" textAlign="center" sx={{ py: 1 }}>{day}</Typography>)}
        {days.map((date, index) => {
          if (!date) return <Box key={"blank-" + index} aria-hidden="true" sx={{ minHeight: { xs: 48, sm: 72 } }} />;
          const daySessions = sessionsByDate.get(date) ?? [];
          const day = Number(date.slice(-2));
          return <Button key={date} role="gridcell" aria-label={day + "/" + (shownMonth.month + 1) + "/" + shownMonth.year + (daySessions.length ? ", " + daySessions.length + " phiên điểm danh" : ", không có điểm danh")} aria-selected={selectedDate === date} onClick={() => { setSelectedDate(date); setSession(null); setMessage(""); }} variant={selectedDate === date ? "contained" : "text"} sx={{ minWidth: 0, minHeight: { xs: 48, sm: 72 }, p: 0.5, borderRadius: 2, display: "flex", flexDirection: "column", justifyContent: "center", gap: 0.25 }}>
            <Typography component="span" variant="body2" fontWeight={selectedDate === date ? 700 : 500}>{day}</Typography>
            {daySessions.length > 0 && <Stack direction="row" spacing={0.25} alignItems="center"><Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: selectedDate === date ? "common.white" : "primary.main" }} /><Typography component="span" variant="caption" sx={{ fontSize: { xs: 9, sm: 11 }, lineHeight: 1.2 }}>{daySessions.length} phiên</Typography></Stack>}
          </Button>;
        })}
      </Box>}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}><Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main" }} /><Typography variant="caption" color="text.secondary">Ngày có điểm danh · Chạm vào ngày để xem</Typography></Stack>
      {!loadingSessions && classId && sessions.length === 0 && <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>Tháng này chưa có phiên điểm danh.</Typography>}
    </Paper>
    <Drawer anchor="bottom" open={Boolean(selectedDate)} onClose={() => { setSelectedDate(""); setSession(null); }} PaperProps={{ sx: { maxHeight: "88dvh", borderRadius: "16px 16px 0 0", pb: "env(safe-area-inset-bottom)" } }}>
      <Box sx={{ width: "100%", maxWidth: 900, maxHeight: "calc(88dvh - 24px)", mx: "auto", p: { xs: 2, sm: 3 }, overflowY: "auto" }}>
        <Box sx={{ width: 36, height: 4, bgcolor: "action.disabled", borderRadius: 99, mx: "auto", mb: 2 }} />
        {session ? <>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
            <Box><Typography variant="h6" fontWeight={700}>{session.class.code} · {session.class.name}</Typography><Typography variant="body2" color="text.secondary">{session.class.subjectName} · {formatSessionTime(session.sessionAt)}</Typography></Box>
            <Button onClick={() => { setSession(null); setMessage(""); }} startIcon={<ArrowBackOutlinedIcon />} sx={{ flexShrink: 0 }}>Danh sách</Button>
          </Stack>
          {message && <Alert severity="success" onClose={() => setMessage("")} sx={{ mb: 2 }}>{message}</Alert>}
          {loadingDetail ? <LoadingState label="Đang tải phiên điểm danh..." minHeight={120} /> : <>
            <Paper variant="outlined" sx={{ overflow: "hidden" }}><AttendanceRecordList records={session.records} onChange={changeRecord} /></Paper>
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}><Button variant="contained" onClick={() => void save()} disabled={saving} sx={{ minHeight: 44 }}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</Button></Stack>
            {session.audits.length > 0 && <Stack spacing={0.5} sx={{ mt: 2 }}><Typography variant="subtitle2">Lịch sử chỉnh sửa</Typography>{session.audits.map((audit) => <Typography key={audit.id} variant="caption" color="text.secondary">{audit.action === "ATTENDANCE_CREATED" ? "Tạo điểm danh" : "Cập nhật điểm danh"} · {audit.actor.fullName} · {formatSessionTime(audit.performedAt)}</Typography>)}</Stack>}
          </>}
        </> : <>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>Điểm danh ngày {selectedDate.split("-").reverse().join("/")}</Typography>
          {selectedDaySessions.length ? <Stack spacing={1}>{selectedDaySessions.map((item) => <Button key={item.id} variant="outlined" onClick={() => void openSession(item.id)} sx={{ justifyContent: "space-between", textAlign: "left", p: 1.5, minHeight: 56 }}><span>{formatSessionTime(item.sessionAt)}</span><Typography component="span" variant="body2">{item.studentCount} học viên</Typography></Button>)}</Stack> : <Typography color="text.secondary" sx={{ py: 2 }}>Ngày này chưa có phiên điểm danh.</Typography>}
          {loadingDetail && <LoadingState label="Đang tải phiên điểm danh..." minHeight={100} />}
        </>}
      </Box>
    </Drawer>
  </Stack>;
}
