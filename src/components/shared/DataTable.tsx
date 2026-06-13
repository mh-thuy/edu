"use client";

import { Box } from "@mui/material";
import { DataGrid, type DataGridProps, type GridColDef, type GridValidRowModel } from "@mui/x-data-grid";
import type { ReactElement } from "react";

type DataTableProps<R extends GridValidRowModel> = {
  rows: R[];
  columns: GridColDef<R>[];
  loading?: boolean;
  pageSizeOptions?: number[];
  disableRowSelectionOnClick?: boolean;
};

export function DataTable<R extends GridValidRowModel>({
  rows,
  columns,
  loading = false,
  pageSizeOptions = [10, 25, 50],
  disableRowSelectionOnClick = true,
}: DataTableProps<R>): ReactElement {
  const dataGridProps: DataGridProps<R> = {
    rows,
    columns,
    loading,
    pageSizeOptions,
    disableRowSelectionOnClick,
    initialState: {
      pagination: {
        paginationModel: {
          page: 0,
          pageSize: pageSizeOptions[0] ?? 10,
        },
      },
    },
  };

  return (
    <Box sx={{ width: "100%", minHeight: 420 }}>
      <DataGrid {...dataGridProps} />
    </Box>
  );
}
