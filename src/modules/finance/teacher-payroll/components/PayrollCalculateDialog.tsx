"use client";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  TeacherSelectDialog,
  type TeacherSelectValue,
} from "@/components/shared/TeacherSelectDialog";

interface PayrollCalculateDialogProps {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { teacherId: string; month: string }) => Promise<void>;
}

export function PayrollCalculateDialog({
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: PayrollCalculateDialogProps) {
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] =
    useState<TeacherSelectValue | null>(null);
  const [month, setMonth] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setMonth(new Date().toISOString().slice(0, 7));
    setSelectedTeacher(null);
  }, [open]);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Calculate Monthly Payroll</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <Stack spacing={2}>
            <Button
              variant="outlined"
              onClick={() => setTeacherDialogOpen(true)}
              sx={{ justifyContent: "flex-start" }}
            >
              {selectedTeacher
                ? `${selectedTeacher.name} (${selectedTeacher.code})`
                : "Select teacher"}
            </Button>

            {!selectedTeacher && (
              <Alert severity="warning">
                Teacher is required to calculate payroll.
              </Alert>
            )}

            <TextField
              type="month"
              label="Month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <Typography variant="body2" color="text.secondary">
              Workflow: Calculate → Draft → Preview → Approve (Lock) → Paid
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!selectedTeacher || !month) {
                return;
              }

              await onSubmit({
                teacherId: selectedTeacher.id,
                month,
              });
            }}
            variant="contained"
            disabled={isSubmitting || !selectedTeacher || !month}
          >
            {isSubmitting ? "Calculating..." : "Calculate"}
          </Button>
        </DialogActions>
      </Dialog>

      <TeacherSelectDialog
        open={teacherDialogOpen}
        onClose={() => setTeacherDialogOpen(false)}
        onSelect={(teacher) => {
          setSelectedTeacher(teacher);
          setTeacherDialogOpen(false);
        }}
      />
    </>
  );
}
