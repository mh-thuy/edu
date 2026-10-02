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
        height: 72,
        px: { xs: 1.5, md: 3 },
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        backdropFilter: "blur(14px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} minWidth={0}>
        <IconButton onClick={onToggleSidebar} aria-label="Mở hoặc thu gọn menu" sx={{ bgcolor: "action.hover", "&:hover": { bgcolor: "action.selected" } }}>
          <MenuOutlinedIcon />
        </IconButton>
        <Typography variant="subtitle1" fontWeight={800} color="text.primary" noWrap>
          EduCenter
        </Typography>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box textAlign="right" sx={{ display: { xs: "none", sm: "block" } }}>
          <Typography variant="body2" fontWeight={600}>
            {user.fullName}
          </Typography>
        </Box>
        <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} size="small" aria-label="Mở menu tài khoản">
          <Avatar sx={{ width: 38, height: 38, bgcolor: "primary.main", fontWeight: 700 }}>{initials}</Avatar>
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
            {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </MenuItem>
        </Menu>
      </Stack>
    </Box>
  );
}
