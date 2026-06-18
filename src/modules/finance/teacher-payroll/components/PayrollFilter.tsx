"use client";

import { useMemo, useState, type ReactElement } from "react";
import { Box, Button, Stack, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import ClearIcon from "@mui/icons-material/Clear";
import {
  TeacherSelectDialog,
  type TeacherSelectValue,
} from "@/components/shared/dialogs/TeacherSelectDialog";
import { PayrollStatus } from "@/modules/payroll/services/payroll.types";

export interface PayrollFilterValue {
  teacherId?: string;
  teacherLabel?: string;
  month?: string;
  status?: PayrollStatus;
}

interface PayrollFilterProps {
  value: PayrollFilterValue;
  onChange: (value: PayrollFilterValue) => void;
  onOpenCalculate: () => void;
}

const statusOptions: Array<{ value: PayrollStatus; label: string }> = [
  { value: PayrollStatus.DRAFT, label: "Draft" },
  { value: PayrollStatus.APPROVED, label: "Approved" },
  { value: PayrollStatus.PAID, label: "Paid" },
];

export function PayrollFilter({
  value,
  onChange,
  onOpenCalculate,
}: PayrollFilterProps): ReactElement {
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);

  const canClear = useMemo(
    () => Boolean(value.teacherId || value.month || value.status),
    [value.month, value.status, value.teacherId],
  );

  const handleTeacherSelect = (teacher: TeacherSelectValue) => {
    onChange({
      ...value,
      teacherId: teacher.id,
      teacherLabel: `${teacher.name} (${teacher.code})`,
    });
  };

  return (
    <>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Button
          variant="outlined"
          startIcon={<PersonSearchIcon />}
          onClick={() => setTeacherDialogOpen(true)}
          sx={{ whiteSpace: "nowrap" }}
        >
          {value.teacherLabel ?? "Filter Teacher"}
        </Button>

        <TextField
          size="small"
          type="month"
          label="Month"
          value={value.month ?? ""}
          onChange={(event) => {
            const month = event.target.value;
            onChange({
              ...value,
              month: month || undefined,
            });
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: { xs: "100%", md: 180 } }}
        />

        <TextField
          size="small"
          select
          label="Status"
          value={value.status ?? ""}
          onChange={(event) => {
            const status = event.target.value as PayrollStatus | "";
            onChange({
              ...value,
              status: status || undefined,
            });
          }}
          SelectProps={{ native: true }}
          sx={{ minWidth: { xs: "100%", md: 160 } }}
        >
          <option value="">All</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </TextField>

        <Box sx={{ flex: 1 }} />

        {canClear && (
          <Button
            variant="text"
            color="inherit"
            startIcon={<ClearIcon />}
            onClick={() => onChange({})}
          >
            Reset
          </Button>
        )}

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onOpenCalculate}
        >
          Calculate Payroll
        </Button>
      </Stack>

      <TeacherSelectDialog
        open={teacherDialogOpen}
        onClose={() => setTeacherDialogOpen(false)}
        onSelect={handleTeacherSelect}
      />
    </>
  );
}
