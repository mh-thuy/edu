import { Box, Stack } from "@mui/material";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage(): Promise<ReactElement> {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

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
