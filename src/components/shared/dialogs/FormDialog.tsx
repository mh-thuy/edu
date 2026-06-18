"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Box,
} from "@mui/material";
import type { ReactElement, ReactNode } from "react";

export interface FormDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => Promise<void> | void;
  formId?: string;
  children: ReactNode;
  isLoading?: boolean;
  submitText?: string;
  cancelText?: string;
}

export function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  formId,
  children,
  isLoading = false,
  submitText = "Save",
  cancelText = "Cancel",
}: FormDialogProps): ReactElement {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>{children}</Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          type={formId ? "submit" : "button"}
          form={formId}
          onClick={formId ? undefined : onSubmit}
          variant="contained"
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : submitText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
