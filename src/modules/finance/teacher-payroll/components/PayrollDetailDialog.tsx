"use client";

import {
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
} from "@mui/material";
import { type ReactElement } from "react";
import {
  PayrollStatus,
  type TeacherPayrollDto,
} from "@/modules/payroll/services/payroll.types";
import { formatCurrency } from "@/modules/finance/teacher-payroll/payroll.types";

interface PayrollDetailDialogProps {
  open: boolean;
  payroll: TeacherPayrollDto | null;
  onClose: () => void;
}

const statusLabelMap: Record<PayrollStatus, string> = {
  [PayrollStatus.DRAFT]: "Draft",
  [PayrollStatus.APPROVED]: "Approved",
  [PayrollStatus.PAID]: "Paid",
};

const statusColorMap = {
  [PayrollStatus.DRAFT]: "warning",
  [PayrollStatus.APPROVED]: "info",
  [PayrollStatus.PAID]: "success",
} as const;

export function PayrollDetailDialog({
  open,
  payroll,
  onClose,
}: PayrollDetailDialogProps): ReactElement {
  if (!payroll) {
    return <Dialog open={false} onClose={onClose} />;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Payroll Detail -{" "}
        {payroll.teacher?.user?.fullName ??
          payroll.teacher?.code ??
          payroll.teacherId}{" "}
        ({payroll.month})
      </DialogTitle>

      <DialogContent sx={{ mt: 1 }}>
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 1.5,
            }}
          >
            <Typography variant="body2">
              <strong>Status:</strong>{" "}
              <Chip
                size="small"
                label={statusLabelMap[payroll.status]}
                color={statusColorMap[payroll.status]}
                sx={{ ml: 1, minWidth: 90, fontWeight: 600 }}
              />
            </Typography>

            <Typography variant="body2">
              <strong>Revenue:</strong>{" "}
              <Box
                component="span"
                sx={{ color: "success.main", fontWeight: 700 }}
              >
                {formatCurrency(payroll.totalRevenue)}
              </Box>
            </Typography>

            <Typography variant="body2">
              <strong>Center Fee:</strong>{" "}
              <Box
                component="span"
                sx={{ color: "error.main", fontWeight: 700 }}
              >
                {formatCurrency(payroll.centerFee)}
              </Box>
            </Typography>

            <Typography variant="body2">
              <strong>Salary:</strong>{" "}
              <Box
                component="span"
                sx={{ color: "primary.main", fontWeight: 700 }}
              >
                {formatCurrency(payroll.salaryAmount)}
              </Box>
            </Typography>

            <Typography variant="body2">
              <strong>Approved At:</strong> {payroll.approvedAt ?? "-"}
            </Typography>

            <Typography variant="body2">
              <strong>Paid At:</strong> {payroll.paidAt ?? "-"}
            </Typography>
          </Box>

          <Typography variant="subtitle2">Class Breakdown</Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Class</TableCell>
                  <TableCell align="right">Students</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                  <TableCell align="right">Center Fee</TableCell>
                  <TableCell align="right">Salary</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(payroll.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.classCode}</TableCell>
                    <TableCell align="right">{item.studentCount}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.revenue)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.fee)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.salary)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
