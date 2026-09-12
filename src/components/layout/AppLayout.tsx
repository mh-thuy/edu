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
  const routeMeta = [
    { prefix: "/admin/tuition-fees/payment-history", title: "Giao dịch thu học phí", section: "Tài chính" },
    { prefix: "/admin/tuition-fees/payment", title: "Thu học phí", section: "Tài chính" },
    { prefix: "/admin/tuition-fees", title: "Các khoản học phí", section: "Tài chính" },
    { prefix: "/admin/bank-reconciliation", title: "Đối soát ngân hàng", section: "Tài chính" },
    { prefix: "/admin/bank-accounts", title: "Tài khoản nhận tiền", section: "Tài chính" },
    { prefix: "/admin/receipts", title: "Biên lai", section: "Tài chính" },
    { prefix: "/admin/reports", title: "Báo cáo", section: "Tài chính" },
    { prefix: "/admin/users", title: "Người dùng", section: "Hệ thống" },
    { prefix: "/admin/teachers", title: "Giáo viên", section: "Đào tạo" },
    { prefix: "/admin/students", title: "Học viên", section: "Đào tạo" },
    { prefix: "/admin/classes", title: "Lớp học", section: "Đào tạo" },
    { prefix: "/admin/subjects", title: "Môn học", section: "Đào tạo" },
    { prefix: "/admin", title: "Dashboard", section: "Tổng quan" },
  ] as const;
  const currentRoute = routeMeta.find((route) => pathname.startsWith(route.prefix));
  const currentTitle = currentRoute?.title ?? "Dashboard";
  const currentSection = currentRoute?.section ?? "Tổng quan";

  const toggleSidebar = () => {
    if (isDesktop) {
      setDesktopCollapsed((previous) => !previous);
      return;
    }

    setMobileOpen((previous) => !previous);
  };

  const sidebar = (
    <Sidebar collapsed={isDesktop && desktopCollapsed} onNavigate={() => setMobileOpen(false)} />
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Desktop sidebar - only visible on lg+ screens */}
      <Box
        sx={{
          display: { xs: "none", lg: "block" },
          width: desktopCollapsed ? 76 : 260,
          height: "100vh",
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          flexShrink: 0,
          overflow: "hidden",
          transition: "width 200ms ease",
          backgroundColor: "background.paper",
          borderRight: 1,
          borderColor: "divider",
        }}
      >
        {sidebar}
      </Box>
      
      {/* Mobile drawer */}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: 260,
            height: "100dvh",
            overflow: "hidden",
          },
        }}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </Drawer>
      
      {/* Main content */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Header user={user} onToggleSidebar={toggleSidebar} currentTitle={currentTitle} currentSection={currentSection} />
        <Box component="main" sx={{ minHeight: "calc(100vh - 72px)", px: { xs: 1.5, sm: 2.5, md: 4 }, py: { xs: 2, md: 3.5 }, bgcolor: "background.default" }}>
          <Box sx={{ maxWidth: 1440, width: "100%", mx: "auto" }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
