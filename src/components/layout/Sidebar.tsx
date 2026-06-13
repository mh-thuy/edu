"use client";

import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import { Box, Divider, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import type { Role } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";

type SidebarItem = {
  label: string;
  href: string;
  icon: ReactElement;
  roles: Role[];
};

const items: SidebarItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <HomeOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF", "TEACHER"],
  },
  {
    label: "Admin",
    href: "/admin",
    icon: <ManageAccountsOutlinedIcon fontSize="small" />,
    roles: ["ADMIN"],
  },
  {
    label: "Staff",
    href: "/staff",
    icon: <MeetingRoomOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF"],
  },
  {
    label: "Teacher",
    href: "/teacher",
    icon: <SchoolOutlinedIcon fontSize="small" />,
    roles: ["ADMIN", "STAFF", "TEACHER"],
  },
];

type SidebarProps = {
  role: Role;
};

export function Sidebar({ role }: SidebarProps): ReactElement {
  const pathname = usePathname();
  const visibleItems = items.filter((item) => item.roles.includes(role));

  return (
    <Box sx={{ width: 280, height: "100%", bgcolor: "background.paper", borderRight: "1px solid", borderColor: "divider" }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} color="primary.main">
          Edu Center
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Classroom Rental
        </Typography>
      </Box>
      <Divider />
      <List sx={{ px: 1.5, py: 2 }}>
        {visibleItems.map((item) => {
          const selected = pathname === item.href;

          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={selected}
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
