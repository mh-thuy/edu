"use client";

import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import ClassOutlinedIcon from "@mui/icons-material/ClassOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";

import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
type SidebarItem = {
  label: string;
  href: string;
  icon: ReactElement;
  section: "Tổng quan" | "Đào tạo" | "Tài chính" | "Hệ thống";
};

const items: SidebarItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: <HomeOutlinedIcon fontSize="small" />,
    section: "Tổng quan",
  },
  {
    label: "Giáo viên",
    href: "/admin/teachers",
    icon: <SchoolOutlinedIcon fontSize="small" />,
    section: "Đào tạo",
  },
  {
    label: "Học viên",
    href: "/admin/students",
    icon: <GroupOutlinedIcon fontSize="small" />,
    section: "Đào tạo",
  },
  {
    label: "Lớp học",
    href: "/admin/classes",
    icon: <ClassOutlinedIcon fontSize="small" />,
    section: "Đào tạo",
  },
  {
    label: "Môn học",
    href: "/admin/subjects",
    icon: <ClassOutlinedIcon fontSize="small" />,
    section: "Đào tạo",
  },
  {
    label: "Các khoản học phí",
    href: "/admin/tuition-fees",
    icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Thu học phí",
    href: "/admin/tuition-fees/payment",
    icon: <PaymentsOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Giao dịch thu học phí",
    href: "/admin/tuition-fees/payment-history",
    icon: <HistoryOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Biên lai",
    href: "/admin/receipts",
    icon: <ReceiptOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Đối soát ngân hàng",
    href: "/admin/bank-reconciliation",
    icon: <AccountBalanceOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Báo cáo",
    href: "/admin/reports",
    icon: <AssessmentOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Tài khoản nhận tiền",
    href: "/admin/bank-accounts",
    icon: <AccountBalanceOutlinedIcon fontSize="small" />,
    section: "Tài chính",
  },
  {
    label: "Người dùng",
    href: "/admin/users",
    icon: <ManageAccountsOutlinedIcon fontSize="small" />,
    section: "Hệ thống",
  },
];

type SidebarProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ collapsed = false, onNavigate }: SidebarProps): ReactElement {
  const pathname = usePathname();
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;

  return (
    <Box
      sx={{
        width: collapsed ? 76 : 260,
        height: "100vh",
        bgcolor: "background.paper",
        overflow: "hidden",
        transition: "width 180ms ease",
      }}
    >
      {/* Logo */}
      <Box sx={{ px: collapsed ? 1.5 : 2.5, py: 2.25 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" justifyContent={collapsed ? "center" : "flex-start"}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2.5,
              display: "grid",
              placeItems: "center",
              color: "white",
              fontWeight: 800,
              bgcolor: "primary.main",
              boxShadow: "0 8px 16px rgba(37,99,235,.22)",
            }}
          >
              E
            </Box>
          <Box sx={{ display: collapsed ? "none" : "block", minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              fontWeight={800}
              color="text.primary"
              lineHeight={1.1}
            >
              EduCenter
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Quản lý đào tạo
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Divider />

      {/* Menu */}
      <List sx={{ px: collapsed ? 1 : 1.5, py: 2 }}>
        {items.map((item, index) => {
          const selected = item.href === activeHref;
          const previousSection = index > 0 ? items[index - 1]?.section : null;

          const button = (
            <ListItemButton
              component={Link}
              href={item.href}
              selected={selected}
              onClick={onNavigate}
              aria-current={selected ? "page" : undefined}
              sx={{
                position: "relative",
                borderRadius: 2,
                mb: 0.5,
                minHeight: 44,
                px: collapsed ? 1.25 : 1.5,
                justifyContent: collapsed ? "center" : "flex-start",
                color: "text.secondary",
                "& .MuiListItemIcon-root": { color: "inherit" },
                "&.Mui-selected": {
                  bgcolor: "primary.light",
                  color: "primary.dark",
                  "&:before": {
                    content: '""',
                    position: "absolute",
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    borderRadius: 3,
                    bgcolor: "primary.main",
                  },
                  "&:hover": { bgcolor: "#bfdbfe" },
                },
                "&:hover": { bgcolor: "#f8fafc", color: "text.primary" },
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, justifyContent: "center" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                sx={{ display: collapsed ? "none" : "block" }}
                primaryTypographyProps={{
                  fontSize: 13.5,
                  fontWeight: selected ? 700 : 500,
                  noWrap: true,
                }}
              />
            </ListItemButton>
          );

          return (
            <Box key={item.href}>
              {!collapsed && item.section !== "Tổng quan" && item.section !== previousSection && (
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{
                    display: "block",
                    px: 1.5,
                    mt: index === 0 ? 0 : 2,
                    mb: 0.5,
                    fontWeight: 700,
                  }}
                >
                  {item.section}
                </Typography>
              )}
              {collapsed ? <Tooltip title={item.label} placement="right">{button}</Tooltip> : button}
            </Box>
          );
        })}
      </List>
    </Box>
  );
}
