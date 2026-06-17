"use client";

import type { ReactElement } from "react";
import { type GridColDef } from "@mui/x-data-grid";
import { BaseSelectDialog } from "@/components/shared/BaseSelectDialog";

export interface ClassItem {
  id: string;
  code: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teacher?: any;
  status?: string;
}

export interface ClassSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (classItem: ClassItem) => void;
}

export function ClassSelectDialog({
  open,
  onClose,
  onSelect,
}: ClassSelectDialogProps): ReactElement {
  const columns: GridColDef<ClassItem>[] = [
    { field: "code", headerName: "Mã lớp", width: 120 },
    { field: "name", headerName: "Tên lớp", flex: 1, minWidth: 200 },
    {
      field: "teacher",
      headerName: "Giáo viên",
      width: 200,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      renderCell: (params) => (params.row.teacher as any)?.user?.name ?? "-",
    },
    {
      field: "status",
      headerName: "Trạng thái",
      width: 120,
      renderCell: (params) => {
        const map: Record<string, string> = {
          DRAFT: "Nháp",
          ACTIVE: "Hoạt động",
          COMPLETED: "Hoàn thành",
          CANCELLED: "Hủy",
        };
        return map[params.value as string] ?? params.value ?? "-";
      },
    },
  ];

  return (
    <BaseSelectDialog<ClassItem>
      open={open}
      onClose={onClose}
      onSelect={onSelect}
      endpoint="/api/classes"
      title="Chọn lớp học"
      columns={columns}
      searchPlaceholder="Nhập mã lớp hoặc tên lớp"
      maxWidth="md"
    />
  );
}
