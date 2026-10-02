"use client";

import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { extractApiErrorMessage } from "@/lib/api-client";
import { getVietnamDate } from "@/lib/vietnam-time";

export function DailyPaymentReportCard() {
  const [date, setDate] = useState(getVietnamDate);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    if (!date) return;
    setExporting(true);
    setError("");
    try {
      const response = await fetch(`/api/reports/daily-payments/export?date=${date}`);
      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Không thể xuất báo cáo ngày"));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bao-cao-thu-hoc-phi-ngay-${date}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xuất báo cáo ngày");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#eff6ff", color: "primary.main", flexShrink: 0 }}>
              <CalendarMonthOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800}>Báo cáo thu trong ngày</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Xuất Excel các khoản thanh toán thành công theo ngày nhận tiền.
              </Typography>
            </Box>
          </Stack>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <DatePickerField label="Ngày báo cáo" value={date} onChange={setDate} textFieldProps={{ size: "small" }} />
          </Box>
          <Button
            variant="contained"
            startIcon={<DownloadOutlinedIcon />}
            onClick={() => void handleExport()}
            disabled={exporting || !date}
            sx={{ whiteSpace: "nowrap" }}
          >
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
