"use client";

import { Box, Stack } from "@mui/material";
import type { ReactElement } from "react";
import { LoginForm } from "./LoginForm";

export function LoginPageContent(): ReactElement {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: 2,
        py: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack spacing={2} alignItems="center" sx={{ width: "100%" }}>
        <LoginForm />
      </Stack>
    </Box>
  );
}
