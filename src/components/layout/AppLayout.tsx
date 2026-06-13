"use client";

import { Box, Drawer } from "@mui/material";
import { useState, type ReactElement, type ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import type { SessionUser } from "@/types/auth";

type AppLayoutProps = {
  user: SessionUser;
  children: ReactNode;
};

export function AppLayout({ user, children }: AppLayoutProps): ReactElement {
  const [open, setOpen] = useState<boolean>(false);
  const sidebar = <Sidebar role={user.role} />;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Desktop sidebar - only visible on lg+ screens */}
      <Box
        sx={{
          display: { xs: "none", lg: "block" },
          width: 280,
          flexShrink: 0,
          backgroundColor: "background.paper",
          borderRight: 1,
          borderColor: "divider",
        }}
      >
        {sidebar}
      </Box>
      
      {/* Mobile drawer */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
      >
        {sidebar}
      </Drawer>
      
      {/* Main content */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Header user={user} onToggleSidebar={() => setOpen((prev) => !prev)} />
        <Box component="main" sx={{ p: { xs: 2, md: 3 } }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
