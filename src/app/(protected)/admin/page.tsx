"use client";

import { Paper, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";

export default function AdminPage(): ReactElement {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1}>
        <Typography variant="h5" fontWeight={700}>
          Admin Workspace
        </Typography>
        <Typography color="text.secondary">
          Route-level authorization for ADMIN role is active.
        </Typography>
      </Stack>
    </Paper>
  );
}
