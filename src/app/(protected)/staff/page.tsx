import { Paper, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import { requireRole } from "@/lib/auth";

export default async function StaffPage(): Promise<ReactElement> {
  await requireRole(["ADMIN", "STAFF"]);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1}>
        <Typography variant="h5" fontWeight={700}>
          Staff Workspace
        </Typography>
        <Typography color="text.secondary">
          Route-level authorization for ADMIN/STAFF roles is active.
        </Typography>
      </Stack>
    </Paper>
  );
}
