"use client";

import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
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
import { useState, useCallback, type ReactElement } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useList } from "@/hooks/useList";
import { LoadingState } from "@/components/shared/feedback/LoadingState";
import { FilterActions } from "@/components/shared/FilterActions";

// Minimum interface selectable items must satisfy
export interface SelectableItem {
  id: string;
}

export type BaseSelectDialogProps<T extends SelectableItem> = {
  open: boolean;
  onClose: () => void;
  onSelect?: (item: T) => void;
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
  /** Additional query params */
  query?: Record<string, string | number | undefined>;
  /** Enable checkbox-based selection across pages. */
  multiple?: boolean;
  /** Maximum number of rows that can be selected in multiple mode. */
  maxSelected?: number;
  onSelectMany?: (items: T[]) => void;
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
  query,
  multiple = false,
  maxSelected,
  onSelectMany,
}: BaseSelectDialogProps<T>): ReactElement {
  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState<string | undefined>(
    undefined,
  );
  const [selectedItems, setSelectedItems] = useState<Map<string, T>>(
    () => new Map(),
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
      ...query,
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
      if (multiple) return;
      const item = data?.items.find((i) => i.id === id);
      if (item) {
        onSelect?.(item);
        // reset state for next open
        setSearchInput("");
        setCommittedSearch(undefined);
        setPageNumber(1);
        onClose();
      }
    },
    [data, multiple, onSelect, onClose, setPageNumber],
  );

  const handleClose = useCallback(() => {
    setSearchInput("");
    setCommittedSearch(undefined);
    setSelectedItems(new Map());
    setPageNumber(1);
    onClose();
  }, [onClose, setPageNumber]);

  const handleMultipleSelection = useCallback((item: T) => {
    setSelectedItems((current) => {
      const next = new Map(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else if (maxSelected === undefined || next.size < maxSelected) {
        next.set(item.id, item);
      }
      return next;
    });
  }, [maxSelected]);

  const handleConfirmMultipleSelection = useCallback(() => {
    if (selectedItems.size === 0 || !onSelectMany) return;
    onSelectMany([...selectedItems.values()]);
    setSelectedItems(new Map());
    setSearchInput("");
    setCommittedSearch(undefined);
    setPageNumber(1);
    onClose();
  }, [onClose, onSelectMany, selectedItems, setPageNumber]);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const displayColumns: GridColDef<T>[] = multiple
    ? [
        {
          field: "__select",
          headerName: "Chọn",
          width: 70,
          sortable: false,
          filterable: false,
          disableColumnMenu: true,
          renderCell: (params) => {
            const selected = selectedItems.has(params.row.id);
            const atLimit = maxSelected !== undefined && selectedItems.size >= maxSelected;
            return (
              <Checkbox
                checked={selected}
                disabled={!selected && atLimit}
                inputProps={{ "aria-label": `Chọn ${String(params.row.id)}` }}
                onClick={(event) => event.stopPropagation()}
                onChange={() => handleMultipleSelection(params.row)}
              />
            );
          },
        },
        ...columns,
      ]
    : columns;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth={maxWidth}>
      <DialogTitle>{title}</DialogTitle>

      <DialogContent sx={{ pt: 2 }} dividers>
        <Stack spacing={2}>
          {/* Search bar */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
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
            <FilterActions
              onSearch={handleSearch}
              onClear={handleClear}
              hasFilters={Boolean(searchInput || committedSearch)}
              isLoading={isLoading}
            />
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
            <LoadingState label="Đang tải danh sách..." minHeight={180} />
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
                columns={displayColumns}
                localeText={{
                  noRowsLabel: "Không có dữ liệu",
                  noResultsOverlayLabel: "Không tìm thấy dữ liệu phù hợp",
                  footerRowSelected: (count) => `${count} dòng đã chọn`,
                  footerTotalRows: "Tổng số dòng:",
                  paginationRowsPerPage: "Số dòng/trang:",
                  paginationDisplayedRows: ({ from, to, count }) =>
                    `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`,
                }}
                pageSizeOptions={[5, 10, 25]}
                paginationModel={{ page: page - 1, pageSize }}
                onPaginationModelChange={(model) => {
                  setPageNumber(model.page + 1);
                  setPageSize(model.pageSize);
                }}
                rowCount={total}
                paginationMode="server"
                loading={isLoading}
                slots={{ loadingOverlay: SelectDialogLoadingOverlay }}
                disableRowSelectionOnClick
                onRowClick={(params) => handleRowClick(String(params.row.id))}
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
        {multiple && (
          <Button
            onClick={handleConfirmMultipleSelection}
            variant="contained"
            disabled={selectedItems.size === 0 || !onSelectMany}
            sx={{ mr: "auto" }}
          >
            Chọn {selectedItems.size} lớp
          </Button>
        )}
        <Button onClick={handleClose} color="inherit" variant="outlined">
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SelectDialogLoadingOverlay() {
  return <LoadingState label="Đang tải danh sách..." inline size={24} />;
}
