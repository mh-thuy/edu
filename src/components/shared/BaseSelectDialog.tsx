"use client";

import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useState, useCallback, type ReactElement } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useList } from "@/hooks/useList";

// Minimum interface selectable items must satisfy
export interface SelectableItem {
  id: string;
}

export type BaseSelectDialogProps<T extends SelectableItem> = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: T) => void;
  /** API endpoint to fetch paginated list from */
  endpoint: string;
  /** Dialog title */
  title: string;
  /** DataGrid column definitions */
  columns: GridColDef<T>[];
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Dialog max width */
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
};

export function BaseSelectDialog<T extends SelectableItem>({
  open,
  onClose,
  onSelect,
  endpoint,
  title,
  columns,
  searchPlaceholder = "Tìm kiếm...",
  maxWidth = "md",
}: BaseSelectDialogProps<T>): ReactElement {
  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState<string | undefined>(
    undefined,
  );

  const {
    data,
    isLoading,
    error,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
  } =
    useList<T>(endpoint, {
      search: committedSearch,
      pageSize: 10,
    });

  const handleSearch = useCallback(() => {
    setCommittedSearch(searchInput.trim() || undefined);
    setPageNumber(1);
  }, [searchInput, setPageNumber]);

  const handleClear = useCallback(() => {
    setSearchInput("");
    setCommittedSearch(undefined);
    setPageNumber(1);
  }, [setPageNumber]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch],
  );

  const handleRowClick = useCallback(
    (id: string) => {
      const item = data?.items.find((i) => i.id === id);
      if (item) {
        onSelect(item);
        // reset state for next open
        setSearchInput("");
        setCommittedSearch(undefined);
        onClose();
      }
    },
    [data, onSelect, onClose],
  );

  const handleClose = useCallback(() => {
    setSearchInput("");
    setCommittedSearch(undefined);
    onClose();
  }, [onClose]);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth={maxWidth}>
      <DialogTitle>{title}</DialogTitle>

      <DialogContent sx={{ pt: 2 }} dividers>
        <Stack spacing={2}>
          {/* Search bar */}
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder={searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              sx={{ px: 3, whiteSpace: "nowrap" }}
            >
              Tìm
            </Button>
            {(searchInput || committedSearch) && (
              <Button
                variant="outlined"
                onClick={handleClear}
                startIcon={<ClearIcon />}
              >
                Xóa
              </Button>
            )}
          </Stack>

          {/* Error state */}
          {error && (
            <Card variant="outlined">
              <CardContent>
                <Typography color="error">{error}</Typography>
              </CardContent>
            </Card>
          )}

          {/* Loading state (initial) */}
          {isLoading && rows.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : !isLoading && rows.length === 0 ? (
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" align="center">
                  Không có dữ liệu
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Box sx={{ height: 400 }}>
              <DataGrid
                rows={rows}
                columns={columns}
                pageSizeOptions={[5, 10, 25]}
                paginationModel={{ page: page - 1, pageSize }}
                onPaginationModelChange={(model) => {
                  setPageNumber(model.page + 1);
                  setPageSize(model.pageSize);
                }}
                rowCount={total}
                paginationMode="server"
                loading={isLoading}
                disableRowSelectionOnClick
                onRowClick={(params) => handleRowClick(params.row.id as string)}
                onRowDoubleClick={(params) =>
                  handleRowClick(params.row.id as string)
                }
                sx={{
                  border: "none",
                  cursor: "pointer",
                  "& .MuiDataGrid-row:hover": {
                    bgcolor: "action.hover",
                  },
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
        <Button onClick={handleClose} color="inherit">
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
