import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import { Alert, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import { requireAuth } from "@/lib/auth";

export default async function HomePage(): Promise<ReactElement> {
  const user = await requireAuth();

  return (
    <Stack spacing={2.5}>
      <Typography variant="h4" fontWeight={700}>
        Welcome, {user.fullName}
      </Typography>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DashboardOutlinedIcon color="primary" />
              <Typography variant="h6">System Foundation Ready</Typography>
            </Stack>
            <Chip label={user.role} color="primary" variant="outlined" />
          </Stack>
          <Alert severity="info" sx={{ mt: 2 }}>
            Business modules will be implemented in the next development steps.
          </Alert>
        </CardContent>
      </Card>
    </Stack>
  );
}
