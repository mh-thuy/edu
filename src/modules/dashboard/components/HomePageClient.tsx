"use client";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import { Alert, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import type { SessionUser } from "@/types/auth";

type HomePageClientProps = {
  user: SessionUser;
};

export function HomePageClient({ user }: HomePageClientProps): ReactElement {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");

  return (
    <Stack spacing={2.5}>
      <Typography variant="h4" fontWeight={700}>
        {tCommon("welcome")}, {user.fullName}
      </Typography>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DashboardOutlinedIcon color="primary" />
              <Typography variant="h6">{t("systemFoundationReady")}</Typography>
            </Stack>
            <Chip label={user.role} color="primary" variant="outlined" />
          </Stack>
          <Alert severity="info" sx={{ mt: 2 }}>
            {t("businessModulesWillBeImplemented")}
          </Alert>
        </CardContent>
      </Card>
    </Stack>
  );
}
