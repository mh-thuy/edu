"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  type ButtonProps,
} from "@mui/material";
import type { ReactElement } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: ButtonProps["color"];
}

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmColor = "error",
}: ConfirmDialogProps): ReactElement {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={confirmColor}
          disabled={isLoading}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
