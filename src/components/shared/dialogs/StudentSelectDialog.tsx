"use client";

import type { ReactElement } from "react";
import { type GridColDef } from "@mui/x-data-grid";
import { BaseSelectDialog } from "@/components/shared/dialogs/BaseSelectDialog";

export interface StudentItem {
  id: string;
  code: string;
  fullName: string;
  phone?: string;
  email?: string;
  status?: string;
}

export interface StudentSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (studentItem: StudentItem) => void;
}

export function StudentSelectDialog({
  open,
  onClose,
  onSelect,
}: StudentSelectDialogProps): ReactElement {
  const columns: GridColDef<StudentItem>[] = [
    { field: "code", headerName: "Mã học sinh", width: 120 },
    { field: "fullName", headerName: "Tên học sinh", flex: 1, minWidth: 200 },
    {
      field: "phone",
      headerName: "Số điện thoại",
      width: 150,
      renderCell: (params) => params.value ?? "-",
    },
    {
      field: "email",
      headerName: "Email",
      width: 200,
      renderCell: (params) => params.value ?? "-",
    },
    {
      field: "status",
      headerName: "Trạng thái",
      width: 120,
      renderCell: (params) => {
        const map: Record<string, string> = {
          ACTIVE: "Hoạt động",
          INACTIVE: "Không hoạt động",
          GRADUATED: "Tốt nghiệp",
        };
        return map[params.value as string] ?? params.value ?? "-";
      },
    },
  ];

  return (
    <BaseSelectDialog<StudentItem>
      open={open}
      onClose={onClose}
      onSelect={onSelect}
      endpoint="/api/students"
      title="Chọn học sinh"
      columns={columns}
      searchPlaceholder="Nhập mã hoặc tên học sinh"
      maxWidth="lg"
    />
  );
}
