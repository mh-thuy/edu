"use client";

import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import ClassOutlinedIcon from "@mui/icons-material/ClassOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";

import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import type { RoleCode } from "@/constants/roles";

type SidebarItem = {
  label: string;
  href: string;
  icon: ReactElement;
  roles: RoleCode[];
};

const items: SidebarItem[] = [
  {
    label: "Người dùng",
    href: "/admin/users",
    icon: <ManageAccountsOutlinedIcon fontSize="small" />,
    roles: ["ADMIN"],
  },
  {
    label: "Dashboard",
    href: "/admin",
    icon: <HomeOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Giáo viên",
    href: "/admin/teachers",
    icon: <SchoolOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Học viên",
    href: "/admin/students",
    icon: <GroupOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Lớp học",
    href: "/admin/classes",
    icon: <ClassOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Môn học",
    href: "/admin/subjects",
    icon: <ClassOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Học phí",
    href: "/admin/tuition-fees",
    icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Thu học phí",
    href: "/admin/tuition-fees/payment",
    icon: <PaymentsOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Lịch sử thu học phí",
    href: "/admin/tuition-fees/payment-history",
    icon: <HistoryOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Biên lai",
    href: "/admin/receipts",
    icon: <ReceiptOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Đối soát ngân hàng",
    href: "/admin/bank-reconciliation",
    icon: <AccountBalanceOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Tài khoản nhận tiền",
    href: "/admin/bank-accounts",
    icon: <AccountBalanceOutlinedIcon fontSize="small" />,
    roles: ["ADMIN"],
  },
  {
    label: "Lớp của tôi",
    href: "/teacher/classes",
    icon: <ClassOutlinedIcon fontSize="small" />,
    roles: ["TEACHER"],
  },
  {
    label: "Lịch của tôi",
    href: "/teacher/schedules",
    icon: <ScheduleOutlinedIcon fontSize="small" />,
    roles: ["TEACHER"],
  },
];

type SidebarProps = {
  role: RoleCode;
  onNavigate?: () => void;
};

export function Sidebar({ role, onNavigate }: SidebarProps): ReactElement {
  const pathname = usePathname();

  const visibleItems = items.filter((item) => item.roles.includes(role));
  const groupFor = (href: string) =>
    href === "/" || href === "/admin"
      ? "Tổng quan"
      : href.startsWith("/teacher")
        ? "Giáo viên"
        : [
              "/admin/teachers",
              "/admin/students",
              "/admin/classes",
              "/admin/subjects",
              "/admin/users",
            ].includes(href)
          ? "Đào tạo"
          : "Tài chính";

  return (
    <Box
      sx={{
        width: 264,
        height: "100%",
        bgcolor: "#ffffff",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Logo */}
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
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
          <Box>
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
      <List sx={{ px: 1.5, py: 2 }}>
        {visibleItems.map((item, index) => {
          const selected =
            pathname === item.href ||
            (item.href !== "/" &&
              item.href !== "/admin" &&
              pathname.startsWith(`${item.href}/`));
          const group = groupFor(item.href);
          const previousGroup =
            index > 0 ? groupFor(visibleItems[index - 1]!.href) : null;

          return (
            <Box key={item.href}>
              {group !== "Tổng quan" && group !== previousGroup && (
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
                  {group}
                </Typography>
              )}
              <ListItemButton
                component={Link}
                href={item.href}
                selected={selected}
                onClick={onNavigate}
                sx={{
                  borderRadius: 2.5,
                  mb: 0.5,
                  minHeight: 44,
                  color: "text.secondary",
                  "& .MuiListItemIcon-root": { color: "inherit" },
                  "&.Mui-selected": {
                    bgcolor: "#eff6ff",
                    color: "primary.main",
                    "&:hover": { bgcolor: "#dbeafe" },
                  },
                  "&:hover": { bgcolor: "#f8fafc", color: "text.primary" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: selected ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </Box>
          );
        })}
      </List>
    </Box>
  );
}
