"use client";

import { Box, Card, CardContent, CircularProgress, Typography } from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridValidRowModel,
} from "@mui/x-data-grid";
import type { ReactElement } from "react";

export interface BaseTableProps<T extends GridValidRowModel> {
  columns: GridColDef<T>[];
  rows: T[];
  totalRows: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  error?: string | null;
}

export function BaseTable<T extends GridValidRowModel>({
  columns,
  rows,
  totalRows,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onPageSizeChange,
  error,
}: BaseTableProps<T>): ReactElement {
  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">{error}</Typography>
        </CardContent>
      </Card>
    );
  }

  if (isLoading && rows.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const handlePaginationModelChange = (model: GridPaginationModel) => {
    const nextPage = model.page + 1;

    if (nextPage !== page) {
      onPageChange(nextPage);
    }

    if (model.pageSize !== pageSize) {
      onPageSizeChange(model.pageSize);
    }
  };

  return (
    <Card>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSizeOptions={[5, 10, 25, 50]}
        paginationModel={{ page: page - 1, pageSize }}
        onPaginationModelChange={handlePaginationModelChange}
        rowCount={totalRows}
        paginationMode="server"
        loading={isLoading}
        disableRowSelectionOnClick
        localeText={{
          noRowsLabel: "Không có dữ liệu",
          noResultsOverlayLabel: "Không tìm thấy kết quả",
          toolbarDensity: "Mật độ hiển thị",
          toolbarDensityLabel: "Mật độ hiển thị",
          toolbarDensityCompact: "Gọn",
          toolbarDensityStandard: "Tiêu chuẩn",
          toolbarDensityComfortable: "Thoải mái",
          columnsManagementSearchTitle: "Tìm cột",
          columnsManagementShowHideAllText: "Hiện/ẩn tất cả",
          columnsManagementReset: "Đặt lại",
          paginationRowsPerPage: "Số dòng/trang",
          paginationDisplayedRows: ({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`,
        }}
        sx={{
          border: "none",
          minHeight: 280,
          "& .MuiDataGrid-cell": {
            borderBottom: "1px solid var(--mui-palette-divider)",
          },
        }}
      />
    </Card>
  );
}
