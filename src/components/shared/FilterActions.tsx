"use client";

import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { Button, Stack } from "@mui/material";

type FilterActionsProps = {
  onSearch: () => void;
  onClear: () => void;
  hasFilters: boolean;
  isLoading?: boolean;
};

export function FilterActions({ onSearch, onClear, hasFilters, isLoading = false }: FilterActionsProps) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexShrink: 0 }}>
      <Button
        variant="contained"
        startIcon={<SearchOutlinedIcon />}
        onClick={onSearch}
        disabled={isLoading}
        sx={{ minWidth: { sm: 128 }, whiteSpace: "nowrap" }}
      >
        Tìm kiếm
      </Button>
      <Button
        variant="outlined"
        startIcon={<RestartAltOutlinedIcon />}
        onClick={onClear}
        disabled={!hasFilters || isLoading}
        sx={{ minWidth: { sm: 148 }, whiteSpace: "nowrap" }}
      >
        Xóa bộ lọc
      </Button>
    </Stack>
  );
}
