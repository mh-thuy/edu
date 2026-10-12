"use client";

import { Box, Checkbox, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";

export type AttendanceRow = {
  enrollmentId: string;
  student: { id: string; code: string; fullName: string };
  status: "PRESENT" | "ABSENT";
  note: string;
};

type Props = {
  records: AttendanceRow[];
  onChange: (enrollmentId: string, changes: Partial<Pick<AttendanceRow, "status" | "note">>) => void;
};

export function AttendanceRecordList({ records, onChange }: Props) {
  if (!records.length) return <Typography color="text.secondary" sx={{ p: 2 }}>Lớp chưa có học viên đang theo học môn này.</Typography>;
  return <>
    <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" }, p: 1.5 }}>
      {records.map((record) => <Paper key={record.enrollmentId} variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Checkbox checked={record.status === "PRESENT"} inputProps={{ "aria-label": `Điểm danh ${record.student.fullName} có mặt` }} onChange={(event) => onChange(record.enrollmentId, { status: event.target.checked ? "PRESENT" : "ABSENT", ...(event.target.checked ? { note: "" } : {}) })} sx={{ p: 1, ml: -1 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700}>{record.student.fullName}</Typography>
            <Typography variant="caption" color="text.secondary">{record.student.code}</Typography>
          </Box>
          <Typography variant="body2" color={record.status === "PRESENT" ? "success.main" : "text.secondary"}>{record.status === "PRESENT" ? "Có mặt" : "Vắng"}</Typography>
        </Stack>
        {record.status === "ABSENT" && <TextField label="Ghi chú vắng (không bắt buộc)" size="small" fullWidth value={record.note} inputProps={{ maxLength: 500 }} onChange={(event) => onChange(record.enrollmentId, { note: event.target.value })} sx={{ mt: 1 }} />}
      </Paper>)}
    </Stack>
    <Box sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 620 }}>
        <TableHead><TableRow><TableCell>Mã học viên</TableCell><TableCell>Họ tên</TableCell><TableCell align="center">Có mặt</TableCell><TableCell>Ghi chú vắng (không bắt buộc)</TableCell></TableRow></TableHead>
        <TableBody>{records.map((record) => <TableRow key={record.enrollmentId} hover>
          <TableCell>{record.student.code}</TableCell><TableCell>{record.student.fullName}</TableCell>
          <TableCell align="center"><Checkbox checked={record.status === "PRESENT"} inputProps={{ "aria-label": `Điểm danh ${record.student.fullName} có mặt` }} onChange={(event) => onChange(record.enrollmentId, { status: event.target.checked ? "PRESENT" : "ABSENT", ...(event.target.checked ? { note: "" } : {}) })} /></TableCell>
          <TableCell><TextField size="small" fullWidth placeholder="Ghi chú nếu cần" value={record.note} disabled={record.status === "PRESENT"} inputProps={{ maxLength: 500 }} onChange={(event) => onChange(record.enrollmentId, { note: event.target.value })} /></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </Box>
  </>;
}
