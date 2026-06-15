/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Box,
  CircularProgress,
  Typography,
  Card,
  CardContent,
} from "@mui/material";
import { useState, type ReactElement } from "react";
import { useList } from "@/hooks/useList";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

interface ClassItem {
  id: string;
  code: string;
  name: string;
  teacher?: any;
  status?: string;
}

interface ClassSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (classItem: ClassItem) => void;
}

export function ClassSelectDialog({
  open,
  onClose,
  onSelect,
}: ClassSelectDialogProps): ReactElement {
  const [searchValue, setSearchValue] = useState("");
  const { data, isLoading, error, page, limit, setPageNumber, setPageSize } =
    useList<ClassItem>("/api/classes", {
      search: searchValue || undefined,
      limit: 10,
    });

  const handleSearch = () => {
    setPageNumber(1);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setPageNumber(1);
  };

  const handleRowClick = (id: string) => {
    const selectedClass = data?.items.find((c) => c.id === id);
    if (selectedClass) {
      onSelect(selectedClass);
      setSearchValue("");
      onClose();
    }
  };

  const handleRowDoubleClick = (id: string) => {
    handleRowClick(id);
  };

  const columns: GridColDef[] = [
    { field: "code", headerName: "Mã lớp", width: 120 },
    { field: "name", headerName: "Tên lớp", flex: 1, minWidth: 200 },
    {
      field: "teacher",
      headerName: "Giáo viên",
      width: 200,
      renderCell: (params) => {
        const teacher = params.row.teacher;
        return teacher?.user?.name || "-";
      },
    },
    {
      field: "status",
      headerName: "Trạng thái",
      width: 120,
      renderCell: (params) => {
        const status = params.value;
        const statusMap: Record<string, string> = {
          DRAFT: "Nháp",
          ACTIVE: "Hoạt động",
          COMPLETED: "Hoàn thành",
          CANCELLED: "Hủy",
        };
        return statusMap[status] || status || "-";
      },
    },
  ];

  const rows = data?.items || [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Chọn lớp học</DialogTitle>
      <DialogContent sx={{ pt: 2 }} dividers>
        <Stack spacing={2}>
          {/* Search Section */}
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="Nhập mã lớp hoặc tên lớp"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              fullWidth
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <Button variant="contained" onClick={handleSearch} sx={{ px: 3 }}>
              Tìm kiếm
            </Button>
            <Button
              variant="outlined"
              onClick={handleClearSearch}
              sx={{ px: 3 }}
            >
              Xóa điều kiện
            </Button>
          </Stack>

          {/* Error */}
          {error && (
            <Card>
              <CardContent>
                <Typography color="error">{error}</Typography>
              </CardContent>
            </Card>
          )}

          {/* Loading or Table */}
          {isLoading && rows.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent>
                <Typography>Không có dữ liệu</Typography>
              </CardContent>
            </Card>
          ) : (
            <Box sx={{ height: 400 }}>
              <DataGrid
                rows={rows}
                columns={columns}
                pageSizeOptions={[5, 10, 25]}
                paginationModel={{ page: page - 1, pageSize: limit }}
                onPaginationModelChange={(model) => {
                  setPageNumber(model.page + 1);
                  setPageSize(model.pageSize);
                }}
                rowCount={data?.total || 0}
                paginationMode="server"
                loading={isLoading}
                disableRowSelectionOnClick
                onRowClick={(params) => {
                  handleRowClick(params.row.id);
                }}
                onRowDoubleClick={(params) => {
                  handleRowDoubleClick(params.row.id);
                }}
                sx={{
                  border: "none",
                  cursor: "pointer",
                  "& .MuiDataGrid-cell": {
                    borderBottom: "1px solid var(--mui-palette-divider)",
                  },
                }}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
