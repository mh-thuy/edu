"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import type { ReactElement, ReactNode } from "react";

type FormDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitting?: boolean;
  children: ReactNode;
};

export function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  submitting = false,
  children,
}: FormDialogProps): ReactElement {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={onSubmit} variant="contained" disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
