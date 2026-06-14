"use client";

import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import {
  Avatar,
  Box,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { useState, useTransition, type ReactElement } from "react";
import { logoutAction } from "@/server-actions/auth.actions";
import type { SessionUser } from "@/types/auth";

type HeaderProps = {
  user: SessionUser;
  onToggleSidebar: () => void;
};

export function Header({ user, onToggleSidebar }: HeaderProps): ReactElement {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const open = Boolean(anchorEl);

  const initials = user.fullName
    .split(" ")
    .filter((token) => token.length > 0)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Box
      component="header"
      sx={{
        height: 64,
        px: 2,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton onClick={onToggleSidebar} aria-label="Toggle sidebar" size="small">
          <MenuOutlinedIcon />
        </IconButton>
        <Typography variant="subtitle1" fontWeight={700}>
          Center Management Platform
        </Typography>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box textAlign="right">
          <Typography variant="body2" fontWeight={600}>
            {user.fullName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user.role}
          </Typography>
        </Box>
        <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} size="small">
          <Avatar sx={{ width: 34, height: 34 }}>{initials}</Avatar>
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              startLogoutTransition(async () => {
                await logoutAction();
              });
            }}
            disabled={isLoggingOut}
          >
            <ListItemIcon>
              <LogoutOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {isLoggingOut ? "Logging out..." : "Logout"}
          </MenuItem>
        </Menu>
      </Stack>
    </Box>
  );
}
