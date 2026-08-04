"use client";

import { Box, Drawer, useMediaQuery, useTheme } from "@mui/material";
import { useState, type ReactElement, type ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import type { SessionUser } from "@/types/auth";
import { usePathname } from "next/navigation";

type AppLayoutProps = {
  user: SessionUser;
  children: ReactNode;
};

export function AppLayout({ user, children }: AppLayoutProps): ReactElement {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"), { noSsr: true });
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const currentTitle = pathname.startsWith("/admin/teachers") ? "Quản lý giáo viên"
    : pathname.startsWith("/admin/students") ? "Quản lý học viên"
      : pathname.startsWith("/admin/classes") ? "Quản lý lớp học"
        : pathname.startsWith("/admin/subjects") ? "Quản lý môn học"
        : pathname.startsWith("/admin/tuition-fees/payment-history") ? "Giao dịch thu học phí"
          : pathname.startsWith("/admin/tuition-fees/payment") ? "Thu học phí"
            : pathname.startsWith("/admin/tuition-fees") ? "Quản lý các khoản học phí"
              : pathname.startsWith("/admin/bank-reconciliation") ? "Đối soát ngân hàng"
                : pathname.startsWith("/admin/bank-accounts") ? "Tài khoản nhận tiền"
                        : pathname.startsWith("/admin/users") ? "Quản lý người dùng"
                          : pathname.startsWith("/admin/receipts") ? "Biên lai"
                    : pathname.startsWith("/teacher/classes") ? "Lớp của tôi"
                      : pathname.startsWith("/teacher/schedules") ? "Lịch của tôi"
                        : "Tổng quan";

  const toggleSidebar = () => {
    if (isDesktop) {
      setDesktopCollapsed((previous) => !previous);
      return;
    }

    setMobileOpen((previous) => !previous);
  };

  const sidebar = (
    <Sidebar role={user.role} onNavigate={() => setMobileOpen(false)} />
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Desktop sidebar - only visible on lg+ screens */}
      <Box
        sx={{
          display: { xs: "none", lg: "block" },
          width: desktopCollapsed ? 0 : 280,
          flexShrink: 0,
          overflow: "hidden",
          transition: "width 200ms ease",
          backgroundColor: "background.paper",
          borderRight: 1,
          borderColor: desktopCollapsed ? "transparent" : "divider",
        }}
      >
        {sidebar}
      </Box>
      
      {/* Mobile drawer */}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      >
        {sidebar}
      </Drawer>
      
      {/* Main content */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Header user={user} onToggleSidebar={toggleSidebar} currentTitle={currentTitle} />
        <Box component="main" sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1600, width: "100%", mx: "auto" }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
