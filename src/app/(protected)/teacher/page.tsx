import { Paper, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import { requireRole } from "@/lib/auth";

export default async function TeacherPage(): Promise<ReactElement> {
  await requireRole(["ADMIN", "STAFF", "TEACHER"]);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1}>
        <Typography variant="h5" fontWeight={700}>
          Teacher Workspace
        </Typography>
        <Typography color="text.secondary">
          Route-level authorization for TEACHER access is active.
        </Typography>
      </Stack>
    </Paper>
  );
}
