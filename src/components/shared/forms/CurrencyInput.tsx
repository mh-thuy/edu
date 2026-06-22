import {
  TextField,
  InputAdornment,
  type SxProps,
  type Theme,
} from "@mui/material";
import type { FieldError } from "react-hook-form";

interface CurrencyInputProps {
  label: string;
  value: number | undefined | null;
  onChange?: (value: number) => void;
  error?: FieldError;
  disabled?: boolean;
  readOnly?: boolean;
  sx?: SxProps<Theme>;
}

export function CurrencyInput({
  label,
  value,
  onChange,
  error,
  disabled,
  readOnly,
  sx,
}: CurrencyInputProps) {
  return (
    <TextField
      label={label}
      fullWidth
      size="small"
      disabled={disabled}
      value={
        value === undefined || value === null
          ? ""
          : Number(value).toLocaleString("vi-VN")
      }
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        onChange?.(raw ? Number(raw) : 0);
      }}
      error={!!error}
      helperText={error?.message}
      sx={{
        "& input": {
          textAlign: "right",
          fontWeight: 600,
          fontSize: "0.95rem",
          letterSpacing: "0.3px",
        },
        "& .MuiInputBase-root": {
          backgroundColor: disabled ? "#f5f5f5" : "white",
        },
        ...sx,
      }}
      InputProps={{
        readOnly,
        endAdornment: (
          <InputAdornment position="end">
            <span
              style={{
                fontSize: 13,
                color: "#757575",
                fontWeight: 500,
              }}
            >
              VND
            </span>
          </InputAdornment>
        ),
      }}
    />
  );
}
