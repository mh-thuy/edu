"use client";

import {
  Box,
  Button,
  FormHelperText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import type { ReactElement } from "react";

export type MasterSelectValue = {
  id: string;
  code: string;
  name: string;
};

export type MasterSelectFieldProps = {
  /** Field label shown above the display area */
  label: string;
  /** Currently selected item, or null/undefined if nothing selected */
  value?: MasterSelectValue | null;
  /** Callback to open the picker dialog */
  onOpen: () => void;
  /** Disable the select button */
  disabled?: boolean;
  /** Validation error message */
  error?: string;
  /** Mark field as required */
  required?: boolean;
  /** Label for the code field (default: "Mã") */
  codeLabel?: string;
  /** Label for the name field (default: "Tên") */
  nameLabel?: string;
};

/**
 * ERP-style lookup field.
 * Displays a readonly code/name pair and a button to open the picker dialog.
 * Stores only the selected id — code and name are display-only.
 */
export function MasterSelectField({
  label,
  value,
  onOpen,
  disabled = false,
  error,
  required = false,
  codeLabel = "Mã",
  nameLabel = "Tên",
}: MasterSelectFieldProps): ReactElement {
  const hasValue = Boolean(value?.id);

  return (
    <Box>
      {/* Field label */}
      <Typography
        component="label"
        variant="body2"
        fontWeight={500}
        color={error ? "error" : "text.primary"}
        sx={{ display: "block", mb: 0.5 }}
      >
        {label}
        {required && (
          <Typography component="span" color="error" sx={{ ml: 0.25 }}>
            *
          </Typography>
        )}
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          px: 2,
          py: 1.5,
          borderColor: error ? "error.main" : "divider",
          borderRadius: 1,
          transition: "border-color 0.2s",
          "&:hover": {
            borderColor: disabled ? undefined : "primary.main",
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          {/* Display area */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {hasValue ? (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={{ xs: 0.5, sm: 3 }}
              >
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  sx={{ minWidth: 0 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {codeLabel}:
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {value!.code}
                  </Typography>
                </Stack>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  sx={{ minWidth: 0 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {nameLabel}:
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {value!.name}
                  </Typography>
                </Stack>
              </Stack>
            ) : (
              <Typography
                variant="body2"
                color="text.disabled"
                fontStyle="italic"
              >
                Chưa chọn
              </Typography>
            )}
          </Box>

          {/* Select / Change button */}
          <Button
            size="small"
            variant={hasValue ? "outlined" : "contained"}
            startIcon={hasValue ? <SwapHorizIcon /> : <SearchIcon />}
            onClick={onOpen}
            disabled={disabled}
            sx={{ flexShrink: 0 }}
          >
            {hasValue ? "Đổi" : "Chọn"}
          </Button>
        </Stack>
      </Paper>

      {/* Error message */}
      {error && (
        <FormHelperText error sx={{ mx: "14px", mt: 0.5 }}>
          {error}
        </FormHelperText>
      )}
    </Box>
  );
}
