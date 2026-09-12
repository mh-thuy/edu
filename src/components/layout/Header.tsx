"use client";

import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import {
  Avatar,
  Box,
  Breadcrumbs,
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
  currentTitle?: string;
  currentSection?: string;
};

export function Header({ user, onToggleSidebar, currentTitle = "Dashboard", currentSection = "Tổng quan" }: HeaderProps): ReactElement {
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
        bgcolor: "rgba(255,255,255,0.88)",
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
        <IconButton onClick={onToggleSidebar} aria-label="Mở hoặc thu gọn menu" sx={{ bgcolor: "#f1f5f9", "&:hover": { bgcolor: "#e2e8f0" } }}>
          <MenuOutlinedIcon />
        </IconButton>
        <Box minWidth={0}>
          <Breadcrumbs
            separator="/"
            sx={{ display: { xs: "none", sm: "flex" }, "& .MuiBreadcrumbs-li": { lineHeight: 1 } }}
          >
            <Typography variant="caption" color="text.secondary">EduCenter</Typography>
            <Typography variant="caption" color="text.secondary">{currentSection}</Typography>
          </Breadcrumbs>
          <Typography variant="h6" fontWeight={800} lineHeight={1.2} noWrap>
            {currentTitle}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box textAlign="right" sx={{ display: { xs: "none", sm: "block" } }}>
          <Typography variant="body2" fontWeight={600}>
            {user.fullName}
          </Typography>
        </Box>
        <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} size="small">
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
