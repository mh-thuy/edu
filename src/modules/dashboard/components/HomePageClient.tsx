"use client";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import { Alert, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import type { SessionUser } from "@/types/auth";

type HomePageClientProps = {
  user: SessionUser;
};

const roleLabels: Record<SessionUser["role"], string> = {
  ADMIN: "Quản trị viên",
  STAFF: "Nhân viên",
  TEACHER: "Giáo viên",
};

export function HomePageClient({ user }: HomePageClientProps): ReactElement {
  return (
    <Stack spacing={2.5}>
      <Typography variant="h4" fontWeight={700}>
        Xin chào, {user.fullName}
      </Typography>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DashboardOutlinedIcon color="primary" />
              <Typography variant="h6">Hệ thống quản lý trung tâm</Typography>
            </Stack>
            <Chip label={roleLabels[user.role]} color="primary" variant="outlined" />
          </Stack>
          <Alert severity="info" sx={{ mt: 2 }}>
            Chào mừng bạn đến với hệ thống quản lý trung tâm đào tạo.
          </Alert>
        </CardContent>
      </Card>
    </Stack>
  );
}
