"use client";

import { Box, Drawer, useMediaQuery, useTheme } from "@mui/material";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import type { SessionUser } from "@/types/auth";

type AppLayoutProps = {
  user: SessionUser;
  children: ReactNode;
};

export function AppLayout({ user, children }: AppLayoutProps): ReactElement {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [open, setOpen] = useState<boolean>(isDesktop);

  useEffect(() => {
    if (isDesktop) {
      setOpen(true);
    }
  }, [isDesktop]);

  const sidebar = <Sidebar role={user.role} />;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {isDesktop ? (
        <Box sx={{ width: 280, flexShrink: 0 }}>{sidebar}</Box>
      ) : (
        <Drawer open={open} onClose={() => setOpen(false)}>
          {sidebar}
        </Drawer>
      )}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Header user={user} onToggleSidebar={() => setOpen((prev) => !prev)} />
        <Box component="main" sx={{ p: { xs: 2, md: 3 } }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
