"use client";

import { Backdrop, CircularProgress } from "@mui/material";
import type { ReactElement } from "react";

type LoadingOverlayProps = {
  open: boolean;
};

export function LoadingOverlay({ open }: LoadingOverlayProps): ReactElement {
  return (
    <Backdrop
      open={open}
      sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 2 }}
    >
      <CircularProgress color="inherit" />
    </Backdrop>
  );
}
