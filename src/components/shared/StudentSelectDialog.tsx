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

interface StudentItem {
  id: string;
  code: string;
  fullName: string;
  phone?: string;
  email?: string;
  status?: string;
}

interface StudentSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (studentItem: StudentItem) => void;
}

export function StudentSelectDialog({
  open,
  onClose,
  onSelect,
}: StudentSelectDialogProps): ReactElement {
  const [searchValue, setSearchValue] = useState("");
  const { data, isLoading, error, page, limit, setPageNumber, setPageSize } =
    useList<StudentItem>("/api/students", {
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
    const selectedStudent = data?.items.find((s) => s.id === id);
    if (selectedStudent) {
      onSelect(selectedStudent);
      setSearchValue("");
      onClose();
    }
  };

  const handleRowDoubleClick = (id: string) => {
    handleRowClick(id);
  };

  const columns: GridColDef[] = [
    { field: "code", headerName: "Mã học sinh", width: 120 },
    { field: "fullName", headerName: "Tên học sinh", flex: 1, minWidth: 200 },
    {
      field: "phone",
      headerName: "Số điện thoại",
      width: 150,
      renderCell: (params) => params.value || "-",
    },
    {
      field: "email",
      headerName: "Email",
      width: 200,
      renderCell: (params) => params.value || "-",
    },
    {
      field: "status",
      headerName: "Trạng thái",
      width: 120,
      renderCell: (params) => {
        const status = params.value;
        const statusMap: Record<string, string> = {
          ACTIVE: "Hoạt động",
          INACTIVE: "Không hoạt động",
          GRADUATED: "Tốt nghiệp",
        };
        return statusMap[status] || status || "-";
      },
    },
  ];

  const rows = data?.items || [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Chọn học sinh</DialogTitle>
      <DialogContent sx={{ pt: 2 }} dividers>
        <Stack spacing={2}>
          {/* Search Section */}
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="Nhập mã hoặc tên học sinh"
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
