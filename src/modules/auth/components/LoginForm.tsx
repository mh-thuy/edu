"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, useTransition, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { loginAction } from "@/server-actions/auth.actions";
import { loginSchema, type LoginInput } from "@/schemas/auth.schema";
import type { AuthActionState } from "@/types/auth";

const initialState: AuthActionState = {
  success: false,
};

export function LoginForm(): ReactElement {
  const { t } = useTranslation("auth");
  const [serverState, setServerState] = useState<AuthActionState>(initialState);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = handleSubmit((values: LoginInput) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", values.email);
      formData.set("password", values.password);

      if (values.rememberMe) {
        formData.set("rememberMe", "on");
      }

      const result = await loginAction(initialState, formData);
      setServerState(result);
    });
  });

  return (
    <Card elevation={8} sx={{ width: "100%", maxWidth: 460, borderRadius: 4 }}>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              {t("signIn")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("loginDescription")}
            </Typography>
          </Box>

          {serverState.message ? <Alert severity="error">{serverState.message}</Alert> : null}

          <Stack component="form" spacing={2} onSubmit={onSubmit} noValidate>
            <TextField
              label={t("email")}
              type="email"
              fullWidth
              autoComplete="email"
              error={Boolean(errors.email || serverState.fieldErrors?.email)}
              helperText={errors.email?.message ?? serverState.fieldErrors?.email}
              {...register("email")}
            />
            <TextField
              label={t("password")}
              type="password"
              fullWidth
              autoComplete="current-password"
              error={Boolean(errors.password || serverState.fieldErrors?.password)}
              helperText={errors.password?.message ?? serverState.fieldErrors?.password}
              {...register("password")}
            />

            <FormControlLabel control={<Checkbox {...register("rememberMe")} />} label={t("rememberMe")} />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={pending}
              startIcon={<LoginOutlinedIcon />}
            >
              {pending ? t("signingIn") : t("login")}
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            {t("demoAccounts")}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
