"use client";

import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import { Button, Stack, Typography } from "@mui/material";
import Link from "next/link";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

export default function ForbiddenPage(): ReactElement {
  const { t } = useTranslation("auth");

  return (
    <Stack
      spacing={2}
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight: "100vh", px: 2, textAlign: "center" }}
    >
      <BlockOutlinedIcon color="error" sx={{ fontSize: 54 }} />
      <Typography variant="h4" fontWeight={700}>
        {t("accessForbidden")}
      </Typography>
      <Typography color="text.secondary">
        {t("youDoNotHavePermission")}
      </Typography>
      <Button component={Link} href="/" variant="contained">
        {t("backToDashboard")}
      </Button>
    </Stack>
  );
}
