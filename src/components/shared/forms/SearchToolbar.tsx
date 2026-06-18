"use client";

import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { InputAdornment, TextField } from "@mui/material";
import type { ReactElement } from "react";

type SearchToolbarProps = {
  value: string;
  placeholder?: string;
  onChange: (nextValue: string) => void;
};

export function SearchToolbar({
  value,
  placeholder = "Search...",
  onChange,
}: SearchToolbarProps): ReactElement {
  return (
    <TextField
      fullWidth
      size="small"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchOutlinedIcon fontSize="small" />
          </InputAdornment>
        ),
      }}
    />
  );
}
