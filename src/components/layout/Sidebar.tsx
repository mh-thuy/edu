"use client";

import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import ClassOutlinedIcon from "@mui/icons-material/ClassOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import AttachMoneyOutlinedIcon from "@mui/icons-material/AttachMoneyOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";

import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
    label: "Tổng quan",
    href: "/",
    icon: <HomeOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF", "TEACHER"],
  },
  {
    label: "Quản lý phòng",
    href: "/admin/rooms",
    icon: <MeetingRoomOutlinedIcon fontSize="small" />,
    roles: ["ADMIN"],
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
    label: "Lịch học",
    href: "/admin/schedules",
    icon: <ScheduleOutlinedIcon fontSize="small" />,
    roles: ["ADMIN"],
  },
  {
    label: "Học phí",
    href: "/admin/student-fees",
    icon: <ReceiptOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Thanh toán",
    href: "/admin/payments",
    icon: <PaymentOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Biên lai",
    href: "/admin/receipts",
    icon: <ReceiptOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
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
  {
    label: "Lương giáo viên",
    href: "/admin/teacher-payroll",
    icon: <AttachMoneyOutlinedIcon fontSize="small" />,
    roles: ["ADMIN"],
  },
  {
    label: "Công nợ",
    href: "/admin/debt-tracking",
    icon: <WarningAmberOutlinedIcon fontSize="small" />,
    roles: ["ADMIN"],
  },
  {
    label: "Báo cáo tài chính",
    href: "/admin/reports",
    icon: <AssessmentOutlinedIcon fontSize="small" />,
    roles: ["ADMIN"],
  },
];

type SidebarProps = {
  role: RoleCode;
};

export function Sidebar({ role }: SidebarProps): ReactElement {
  const pathname = usePathname();

  const visibleItems = items.filter((item) => item.roles.includes(role));

  return (
    <Box
      sx={{
        width: 280,
        height: "100%",
        bgcolor: "background.paper",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Logo */}
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} color="primary.main">
          Trung Tâm Giáo Dục
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Hệ thống quản lý lớp học
        </Typography>
      </Box>

      <Divider />

      {/* Menu */}
      <List sx={{ px: 1.5, py: 2 }}>
        {visibleItems.map((item) => {
          const selected = pathname === item.href;

          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={selected}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                minHeight: 44,
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
          );
        })}
      </List>
    </Box>
  );
}
