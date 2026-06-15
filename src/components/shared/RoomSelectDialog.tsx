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

interface RoomItem {
  id: string;
  code: string;
  name: string;
  capacity?: number;
  floor?: number;
  location?: string;
  status?: string;
}

interface RoomSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (roomItem: RoomItem) => void;
}

export function RoomSelectDialog({
  open,
  onClose,
  onSelect,
}: RoomSelectDialogProps): ReactElement {
  const [searchValue, setSearchValue] = useState("");
  const { data, isLoading, error, page, limit, setPageNumber, setPageSize } =
    useList<RoomItem>("/api/rooms", {
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
    const selectedRoom = data?.items.find((r) => r.id === id);
    if (selectedRoom) {
      onSelect(selectedRoom);
      setSearchValue("");
      onClose();
    }
  };

  const handleRowDoubleClick = (id: string) => {
    handleRowClick(id);
  };

  const columns: GridColDef[] = [
    { field: "code", headerName: "Mã phòng", width: 120 },
    { field: "name", headerName: "Tên phòng", flex: 1, minWidth: 150 },
    {
      field: "capacity",
      headerName: "Sức chứa",
      width: 100,
      renderCell: (params) => params.value || "-",
    },
    {
      field: "floor",
      headerName: "Tầng",
      width: 100,
      renderCell: (params) => params.value || "-",
    },
    {
      field: "location",
      headerName: "Vị trí",
      width: 150,
      renderCell: (params) => params.value || "-",
    },
    {
      field: "status",
      headerName: "Trạng thái",
      width: 120,
      renderCell: (params) => {
        const status = params.value;
        const statusMap: Record<string, string> = {
          AVAILABLE: "Có sẵn",
          OCCUPIED: "Đang sử dụng",
          MAINTENANCE: "Bảo trì",
        };
        return statusMap[status] || status || "-";
      },
    },
  ];

  const rows = data?.items || [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Chọn phòng học</DialogTitle>
      <DialogContent sx={{ pt: 2 }} dividers>
        <Stack spacing={2}>
          {/* Search Section */}
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="Nhập mã phòng hoặc tên phòng"
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
