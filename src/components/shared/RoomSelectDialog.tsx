"use client";

import type { ReactElement } from "react";
import { type GridColDef } from "@mui/x-data-grid";
import { BaseSelectDialog } from "@/components/shared/BaseSelectDialog";

export interface RoomItem {
  id: string;
  code: string;
  name: string;
  capacity?: number;
  floor?: number;
  location?: string;
  status?: string;
}

export interface RoomSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (roomItem: RoomItem) => void;
}

export function RoomSelectDialog({
  open,
  onClose,
  onSelect,
}: RoomSelectDialogProps): ReactElement {
  const columns: GridColDef<RoomItem>[] = [
    { field: "code", headerName: "Mã phòng", width: 120 },
    { field: "name", headerName: "Tên phòng", flex: 1, minWidth: 150 },
    {
      field: "capacity",
      headerName: "Sức chứa",
      width: 100,
      renderCell: (params) => params.value ?? "-",
    },
    {
      field: "floor",
      headerName: "Tầng",
      width: 80,
      renderCell: (params) => params.value ?? "-",
    },
    {
      field: "location",
      headerName: "Vị trí",
      width: 150,
      renderCell: (params) => params.value ?? "-",
    },
    {
      field: "status",
      headerName: "Trạng thái",
      width: 120,
      renderCell: (params) => {
        const map: Record<string, string> = {
          AVAILABLE: "Có sẵn",
          OCCUPIED: "Đang sử dụng",
          MAINTENANCE: "Bảo trì",
        };
        return map[params.value as string] ?? params.value ?? "-";
      },
    },
  ];

  return (
    <BaseSelectDialog<RoomItem>
      open={open}
      onClose={onClose}
      onSelect={onSelect}
      endpoint="/api/rooms"
      title="Chọn phòng học"
      columns={columns}
      searchPlaceholder="Nhập mã phòng hoặc tên phòng"
      maxWidth="lg"
    />
  );
}
