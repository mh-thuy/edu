"use client";

import { Paper, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

export default function StaffPage(): ReactElement {
  const { t } = useTranslation("auth");

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1}>
        <Typography variant="h5" fontWeight={700}>
          {t("staffWorkspace")}
        </Typography>
        <Typography color="text.secondary">
          {t("routeLevelAuthorizationActive")}
        </Typography>
      </Stack>
    </Paper>
  );
}
